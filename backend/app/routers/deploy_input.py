import logging
from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from app.schemas.deploy import DeployInputRequest, DeployInputResponse, WorkloadDeleteResponse
from app.services.security import validate_dns_name, validate_docker_image, validate_safe_url, validate_target_namespace
from app.services.k8s_client import k8s_service
from app.services.builder import builder_service
from app.services.monitor_service import monitor_service

logger = logging.getLogger("kubepulse.deploy_input")

router = APIRouter(prefix="/api/deployments", tags=["Application Deployment"])

@router.post("/deploy-input", response_model=DeployInputResponse)
async def deploy_input(payload: DeployInputRequest):
    """
    Unified entrypoint to deploy or monitor an application based on user input:
    1. Git repository URL: isolated clone, secure Docker image build, deploy to Kubernetes.
    2. Existing Docker image: validates image and deploys to Kubernetes.
    3. Public website URL: sets up availability monitoring (clearly marked as non-Kubernetes).
    """
    try:
        clean_name = validate_dns_name(payload.app_name)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    # -------------------------------------------------------------------------
    # Option 1: Public Website URL (Availability Monitoring Only)
    # -------------------------------------------------------------------------
    if payload.source_type == "website":
        if not payload.website_url:
            raise HTTPException(status_code=400, detail="Website URL is required when source_type is 'website'.")
        
        try:
            monitor_record = await monitor_service.add_monitor(clean_name, payload.website_url)
            return DeployInputResponse(
                success=True,
                app_name=clean_name,
                source_type="website",
                is_deployed_to_k8s=False,
                status="monitored",
                message=f"Public website '{payload.website_url}' successfully registered for availability monitoring. (Not deployed to Kubernetes)",
                details=monitor_record
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except Exception as e:
            logger.error(f"Error registering website monitor: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize website monitor: {str(e)}")

    # -------------------------------------------------------------------------
    # Verify Cluster Connectivity for Kubernetes Deployments
    # -------------------------------------------------------------------------
    try:
        k8s_service._ensure_connected()
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))

    # -------------------------------------------------------------------------
    # Option 2: Existing Docker Image Deployment
    # -------------------------------------------------------------------------
    if payload.source_type == "image":
        if not payload.image_ref:
            raise HTTPException(status_code=400, detail="Image reference is required when source_type is 'image'.")

        try:
            clean_image = validate_docker_image(payload.image_ref)
            target_ns = validate_target_namespace(payload.namespace)

            dep_info = k8s_service.create_or_update_app_deployment(
                name=clean_name,
                image=clean_image,
                port=payload.container_port,
                replicas=payload.replicas,
                namespace=target_ns
            )

            svc_info = k8s_service.create_or_update_app_service(
                name=clean_name,
                port=payload.container_port,
                namespace=target_ns
            )

            return DeployInputResponse(
                success=True,
                app_name=clean_name,
                source_type="image",
                is_deployed_to_k8s=True,
                deployment_name=dep_info["name"],
                service_name=svc_info["name"],
                service_port=svc_info["port"],
                image=clean_image,
                replicas=dep_info["replicas"],
                status="deployed",
                message=f"Successfully deployed container image '{clean_image}' to Kubernetes as Deployment '{clean_name}' with Service '{svc_info['name']}'.",
                details={"deployment": dep_info, "service": svc_info}
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except RuntimeError as re:
            raise HTTPException(status_code=502, detail=str(re))
        except Exception as e:
            logger.error(f"Unexpected error deploying image: {e}")
            raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}")

    # -------------------------------------------------------------------------
    # Option 3: Git Repository Build & Deploy
    # -------------------------------------------------------------------------
    if payload.source_type == "git":
        if not payload.git_url:
            raise HTTPException(status_code=400, detail="Git repository URL is required when source_type is 'git'.")

        try:
            target_ns = validate_target_namespace(payload.namespace)

            # Isolated build
            build_result = await builder_service.build_from_git(
                git_url=payload.git_url,
                app_name=clean_name,
                branch=payload.branch or "main",
                container_port=payload.container_port
            )

            built_image = build_result["image_tag"]

            # Deploy built image to Kubernetes
            dep_info = k8s_service.create_or_update_app_deployment(
                name=clean_name,
                image=built_image,
                port=payload.container_port,
                replicas=payload.replicas,
                namespace=target_ns
            )

            svc_info = k8s_service.create_or_update_app_service(
                name=clean_name,
                port=payload.container_port,
                namespace=target_ns
            )

            return DeployInputResponse(
                success=True,
                app_name=clean_name,
                source_type="git",
                is_deployed_to_k8s=True,
                deployment_name=dep_info["name"],
                service_name=svc_info["name"],
                service_port=svc_info["port"],
                image=built_image,
                replicas=dep_info["replicas"],
                status="deployed",
                message=f"Successfully built image '{built_image}' from Git and deployed to Kubernetes namespace '{target_ns}'.",
                details={"build": build_result, "deployment": dep_info, "service": svc_info}
            )
        except ValueError as ve:
            raise HTTPException(status_code=400, detail=str(ve))
        except TimeoutError as te:
            raise HTTPException(status_code=504, detail=str(te))
        except RuntimeError as re:
            # Check if it was a docker daemon liveness issue
            err_msg = str(re)
            if "Docker daemon is not running" in err_msg:
                raise HTTPException(status_code=503, detail=err_msg)
            raise HTTPException(status_code=502, detail=err_msg)
        except Exception as e:
            logger.error(f"Unexpected error in git deployment: {e}")
            raise HTTPException(status_code=500, detail=f"Git build & deploy failed: {str(e)}")

    raise HTTPException(status_code=400, detail=f"Unsupported source_type '{payload.source_type}'.")


@router.delete("/{name}/workload", response_model=WorkloadDeleteResponse)
async def delete_workload(name: str, namespace: Optional[str] = Query(None)):
    """Deletes an application's Kubernetes Deployment and associated Service."""
    try:
        res = k8s_service.delete_workload(name, namespace)
        return WorkloadDeleteResponse(**res)
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
