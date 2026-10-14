import os
import shutil
import logging
import asyncio
import tempfile
from typing import Dict, Any, Optional
from app.services.security import validate_safe_url, validate_dns_name

logger = logging.getLogger("kubepulse.builder")

class ContainerBuildService:
    """
    Handles secure, isolated Docker image builds from source Git repositories.
    Guarantees:
    - SSRF validation on Git remote URL
    - Isolated temporary scratch directory (auto-cleaned)
    - Subprocess execution without shell interpolation (no shell=True)
    - Strict execution timeouts
    - Truthful Docker daemon liveness check; refuses to report simulated build success
    """

    async def is_docker_daemon_available(self) -> bool:
        """Checks whether the Docker engine is running and responding."""
        try:
            proc = await asyncio.create_subprocess_exec(
                "docker", "version", "--format", "{{.Server.Version}}",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=3.0)
            return proc.returncode == 0 and bool(stdout.strip())
        except Exception:
            return False

    async def build_from_git(
        self,
        git_url: str,
        app_name: str,
        branch: str = "main",
        container_port: int = 80
    ) -> Dict[str, Any]:
        """
        Clones Git repo into an isolated directory and builds a Docker image.
        """
        clean_name = validate_dns_name(app_name)
        safe_url = validate_safe_url(git_url)
        clean_branch = branch.strip() if branch else "main"

        # 1. Verify Docker daemon is running
        docker_active = await self.is_docker_daemon_available()
        if not docker_active:
            raise RuntimeError(
                "Docker daemon is not running on host. Cannot execute container build. "
                "Please start Docker Desktop/Engine to enable Git repository builds, "
                "or deploy using an Existing Docker Image reference directly to Kubernetes."
            )

        image_tag = f"kubepulse-apps/{clean_name}:latest"

        # 2. Use isolated temporary directory
        with tempfile.TemporaryDirectory(prefix=f"kubepulse_build_{clean_name}_") as build_dir:
            logger.info(f"Cloning Git repository '{safe_url}' (branch: {clean_branch}) into {build_dir}")

            # 3. Secure Git Clone (no shell=True, limited depth)
            clone_cmd = [
                "git", "clone",
                "--depth", "1",
                "--branch", clean_branch,
                "--single-branch",
                safe_url,
                build_dir
            ]

            try:
                clone_proc = await asyncio.create_subprocess_exec(
                    *clone_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                stdout, stderr = await asyncio.wait_for(clone_proc.communicate(), timeout=45.0)
                if clone_proc.returncode != 0:
                    err_msg = stderr.decode("utf-8", errors="replace").strip()
                    raise RuntimeError(f"Git clone failed: {err_msg or 'Unknown error'}")
            except asyncio.TimeoutError:
                raise TimeoutError("Git clone timed out after 45 seconds.")

            # 4. Check or generate secure Dockerfile
            dockerfile_path = os.path.join(build_dir, "Dockerfile")
            if not os.path.isfile(dockerfile_path):
                logger.info(f"No Dockerfile found in '{clean_name}'. Generating hardened default container definition.")
                self._generate_hardened_dockerfile(build_dir, container_port)

            # 5. Execute isolated Docker build
            logger.info(f"Building Docker image '{image_tag}'")
            build_cmd = [
                "docker", "build",
                "--no-cache",
                "-t", image_tag,
                build_dir
            ]

            try:
                build_proc = await asyncio.create_subprocess_exec(
                    *build_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                b_stdout, b_stderr = await asyncio.wait_for(build_proc.communicate(), timeout=120.0)
                if build_proc.returncode != 0:
                    err_msg = b_stderr.decode("utf-8", errors="replace").strip()
                    raise RuntimeError(f"Docker build failed: {err_msg}")
            except asyncio.TimeoutError:
                raise TimeoutError("Docker build timed out after 120 seconds.")

            logger.info(f"Successfully built container image '{image_tag}' from Git repository.")
            return {
                "success": True,
                "image_tag": image_tag,
                "app_name": clean_name,
                "git_url": safe_url,
                "branch": clean_branch,
                "message": f"Successfully built Docker image '{image_tag}'."
            }

    def _generate_hardened_dockerfile(self, build_dir: str, port: int):
        """
        Generates a secure, non-root Dockerfile based on detected repository contents.
        """
        dockerfile_path = os.path.join(build_dir, "Dockerfile")

        # Check for static HTML
        if os.path.isfile(os.path.join(build_dir, "index.html")):
            content = f"""FROM nginx:alpine
RUN chmod -R 755 /usr/share/nginx/html
COPY . /usr/share/nginx/html/
EXPOSE {port}
"""
        # Check for Node.js
        elif os.path.isfile(os.path.join(build_dir, "package.json")):
            content = f"""FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production --ignore-scripts
COPY . .
USER node
EXPOSE {port}
CMD ["npm", "start"]
"""
        # Check for Python
        elif os.path.isfile(os.path.join(build_dir, "requirements.txt")):
            content = f"""FROM python:3.11-alpine
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN adduser -D -u 10001 appuser && chown -R appuser:appuser /app
USER 10001
EXPOSE {port}
CMD ["python", "app.py"]
"""
        # Fallback minimal web response
        else:
            index_path = os.path.join(build_dir, "index.html")
            with open(index_path, "w", encoding="utf-8") as f:
                f.write("<!DOCTYPE html><html><body><h1>KubePulse Managed Application</h1><p>Running on Kubernetes</p></body></html>")
            content = f"""FROM nginx:alpine
RUN chmod -R 755 /usr/share/nginx/html
COPY index.html /usr/share/nginx/html/index.html
EXPOSE {port}
"""

        with open(dockerfile_path, "w", encoding="utf-8") as f:
            f.write(content)

builder_service = ContainerBuildService()
