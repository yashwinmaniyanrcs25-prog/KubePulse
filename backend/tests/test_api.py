import pytest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from kubernetes.client.rest import ApiException
from app.main import app
from app.services.k8s_client import k8s_service

client = TestClient(app)

# Helper mock constructors for Kubernetes objects
def create_mock_deployment(name="kubepulse-sample", namespace="kubepulse", desired=1, ready=1, updated=1):
    mock_dep = MagicMock()
    mock_dep.metadata.name = name
    mock_dep.metadata.namespace = namespace
    mock_dep.metadata.creation_timestamp = datetime.now(timezone.utc)
    mock_dep.spec.replicas = desired
    mock_dep.spec.strategy.type = "RollingUpdate"
    mock_dep.spec.selector.match_labels = {"app": "kubepulse-demo"}
    
    # Container & probes
    mock_container = MagicMock()
    mock_container.image = "kubepulse-sample:latest"
    mock_container.readiness_probe.http_get.path = "/ready"
    mock_container.readiness_probe.http_get.port = 8000
    mock_container.readiness_probe.initial_delay_seconds = 3
    mock_container.readiness_probe.period_seconds = 5
    mock_container.readiness_probe.timeout_seconds = 2
    mock_container.readiness_probe.failure_threshold = 3
    
    mock_container.liveness_probe.http_get.path = "/live"
    mock_container.liveness_probe.http_get.port = 8000
    mock_container.liveness_probe.initial_delay_seconds = 5
    mock_container.liveness_probe.period_seconds = 10
    mock_container.liveness_probe.timeout_seconds = 2
    mock_container.liveness_probe.failure_threshold = 3
    
    mock_dep.spec.template.spec.containers = [mock_container]
    mock_dep.status.available_replicas = ready
    mock_dep.status.ready_replicas = ready
    mock_dep.status.updated_replicas = updated
    mock_dep.status.conditions = []
    return mock_dep

def create_mock_pod(name="kubepulse-sample-abc-123", namespace="kubepulse", phase="Running", ready=True, restart_count=0, owning_deploy="kubepulse-sample"):
    mock_pod = MagicMock()
    mock_pod.metadata.name = name
    mock_pod.metadata.namespace = namespace
    mock_pod.metadata.creation_timestamp = datetime.now(timezone.utc)
    mock_pod.metadata.labels = {"app": "kubepulse-demo"}
    
    # Owner reference
    mock_owner = MagicMock()
    mock_owner.kind = "ReplicaSet"
    mock_owner.name = f"{owning_deploy}-7b49f6974"
    mock_pod.metadata.owner_references = [mock_owner]
    
    mock_pod.status.phase = phase
    mock_pod.status.pod_ip = "10.244.0.15"
    mock_pod.spec.node_name = "minikube-worker-01"
    
    # Container status
    mock_cs = MagicMock()
    mock_cs.name = "kubepulse-sample"
    mock_cs.image = "kubepulse-sample:latest"
    mock_cs.ready = ready
    mock_cs.restart_count = restart_count
    mock_cs.state.running = True
    mock_cs.state.waiting = None
    mock_cs.state.terminated = None
    
    mock_pod.status.container_statuses = [mock_cs]
    mock_pod.spec.containers = [MagicMock()]
    
    # Conditions
    mock_cond = MagicMock()
    mock_cond.type = "Ready"
    mock_cond.status = "True" if ready else "False"
    mock_pod.status.conditions = [mock_cond]
    
    return mock_pod


# -----------------------------------------------------------------------------
# 1. ROOT & HEALTH ENDPOINTS
# -----------------------------------------------------------------------------
def test_root_endpoint():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "operational"
    assert "KubePulse" in data["app"]

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "service" in data


# -----------------------------------------------------------------------------
# 2. CLUSTER DISCONNECTED STATE
# -----------------------------------------------------------------------------
def test_cluster_disconnected_state():
    with patch.object(k8s_service, "connect", return_value=False):
        k8s_service.is_connected = False
        k8s_service.error_details = "Connection refused to 127.0.0.1:6443"
        
        response = client.get("/api/cluster/status")
        assert response.status_code == 200
        data = response.json()
        assert data["is_connected"] is False
        assert data["cluster_status"] == "disconnected"
        assert data["reachable"] is False
        assert data["error_details"] is not None

def test_disconnected_operations_raise_503():
    with patch.object(k8s_service, "connect", return_value=False):
        k8s_service.is_connected = False
        
        # Deployments call must fail with 503 Service Unavailable when disconnected
        dep_res = client.get("/api/deployments")
        assert dep_res.status_code == 503
        assert "disconnected" in dep_res.json()["detail"].lower()
        
        # Pods call must fail with 503
        pod_res = client.get("/api/pods")
        assert pod_res.status_code == 503
        
        # Namespaces call must fail with 503
        ns_res = client.get("/api/namespaces")
        assert ns_res.status_code == 503


# -----------------------------------------------------------------------------
# 3. KUBERNETES API ERRORS (502 Bad Gateway)
# -----------------------------------------------------------------------------
def test_k8s_api_errors_raise_502():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.apps_v1.list_namespaced_deployment.side_effect = ApiException(status=500, reason="Internal Server Error")
    
    response = client.get("/api/deployments")
    assert response.status_code == 502
    assert "Kubernetes API error" in response.json()["detail"]


# -----------------------------------------------------------------------------
# 4. EMPTY NAMESPACES
# -----------------------------------------------------------------------------
def test_empty_namespaces():
    k8s_service.is_connected = True
    k8s_service.core_v1 = MagicMock()
    
    mock_list = MagicMock()
    mock_list.items = []
    k8s_service.core_v1.list_namespace.return_value = mock_list
    
    response = client.get("/api/namespaces")
    assert response.status_code == 200
    assert response.json() == []


# -----------------------------------------------------------------------------
# 5. ACTUAL DEPLOYMENT REPLICA COUNTS & PROBES
# -----------------------------------------------------------------------------
def test_actual_deployment_replica_counts():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    
    mock_dep = create_mock_deployment(name="kubepulse-sample", desired=3, ready=3, updated=3)
    mock_list = MagicMock()
    mock_list.items = [mock_dep]
    k8s_service.apps_v1.list_namespaced_deployment.return_value = mock_list
    
    response = client.get("/api/deployments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    dep = data[0]
    assert dep["name"] == "kubepulse-sample"
    assert dep["desired_replicas"] == 3
    assert dep["ready_replicas"] == 3
    assert dep["available_replicas"] == 3
    assert dep["probes"]["readiness"]["path"] == "/ready"
    assert dep["probes"]["liveness"]["path"] == "/live"


# -----------------------------------------------------------------------------
# 6. POD READINESS & RESTART COUNTS
# -----------------------------------------------------------------------------
def test_pod_readiness_and_restart_counts():
    k8s_service.is_connected = True
    k8s_service.core_v1 = MagicMock()
    
    mock_pod = create_mock_pod(name="kubepulse-sample-pod-1", phase="Running", ready=True, restart_count=4)
    mock_list = MagicMock()
    mock_list.items = [mock_pod]
    k8s_service.core_v1.list_namespaced_pod.return_value = mock_list
    
    response = client.get("/api/pods")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    pod = data[0]
    assert pod["name"] == "kubepulse-sample-pod-1"
    assert pod["phase"] == "Running"
    assert pod["ready"] is True
    assert pod["ready_containers"] == "1/1"
    assert pod["restart_count"] == 4
    assert pod["pod_ip"] == "10.244.0.15"


# -----------------------------------------------------------------------------
# 7. REAL SCALING OPERATIONS & FAILURES
# -----------------------------------------------------------------------------
def test_scale_deployment_success():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    
    mock_scale_before = MagicMock()
    mock_scale_before.spec.replicas = 1
    k8s_service.apps_v1.read_namespaced_deployment_scale.return_value = mock_scale_before
    
    mock_scale_after = MagicMock()
    mock_scale_after.spec.replicas = 3
    k8s_service.apps_v1.patch_namespaced_deployment_scale.return_value = mock_scale_after
    
    response = client.patch(
        "/api/deployments/kubepulse-sample/scale",
        json={"replicas": 3}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["previous_replicas"] == 1
    assert data["target_replicas"] == 3

def test_scale_deployment_invalid_bounds():
    response_neg = client.patch(
        "/api/deployments/kubepulse-sample/scale",
        json={"replicas": -1}
    )
    assert response_neg.status_code in [400, 422]

    response_high = client.patch(
        "/api/deployments/kubepulse-sample/scale",
        json={"replicas": 99}
    )
    assert response_high.status_code in [400, 422]

def test_scale_deployment_api_failure():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.apps_v1.read_namespaced_deployment_scale.return_value = MagicMock()
    k8s_service.apps_v1.patch_namespaced_deployment_scale.side_effect = ApiException(status=403, reason="Forbidden")
    
    response = client.patch(
        "/api/deployments/kubepulse-sample/scale",
        json={"replicas": 3}
    )
    assert response.status_code == 502
    assert "Forbidden" in response.json()["detail"]


# -----------------------------------------------------------------------------
# 8. POD DELETION & OWNERSHIP GUARDRAILS
# -----------------------------------------------------------------------------
def test_pod_deletion_guardrails_foreign_workload():
    k8s_service.is_connected = True
    k8s_service.core_v1 = MagicMock()
    
    # Pod belongs to different deployment "other-service"
    mock_foreign_pod = create_mock_pod(name="other-pod-1", owning_deploy="other-service")
    mock_list = MagicMock()
    mock_list.items = [mock_foreign_pod]
    k8s_service.core_v1.list_namespaced_pod.return_value = mock_list
    
    # Attempting to delete should be rejected with 403 Forbidden
    response = client.delete("/api/pods/other-pod-1")
    assert response.status_code == 403
    assert "protected" in response.json()["detail"].lower() or "guardrail" in response.json()["detail"].lower()

def test_pod_deletion_non_existent():
    k8s_service.is_connected = True
    k8s_service.core_v1 = MagicMock()
    
    mock_list = MagicMock()
    mock_list.items = []
    k8s_service.core_v1.list_namespaced_pod.return_value = mock_list
    
    response = client.delete("/api/pods/non-existent-pod")
    assert response.status_code == 404

def test_pod_deletion_success():
    k8s_service.is_connected = True
    k8s_service.core_v1 = MagicMock()
    
    mock_pod = create_mock_pod(name="kubepulse-sample-victim", owning_deploy="kubepulse-sample")
    mock_list = MagicMock()
    mock_list.items = [mock_pod]
    k8s_service.core_v1.list_namespaced_pod.return_value = mock_list
    k8s_service.core_v1.delete_namespaced_pod.return_value = MagicMock()
    
    response = client.delete("/api/pods/kubepulse-sample-victim")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["pod_name"] == "kubepulse-sample-victim"
    k8s_service.core_v1.delete_namespaced_pod.assert_called_once_with(
        name="kubepulse-sample-victim",
        namespace="kubepulse"
    )


# -----------------------------------------------------------------------------
# 9. REPLACEMENT OBSERVATION & SELF-HEALING RECOVERY
# -----------------------------------------------------------------------------
def test_replacement_observation_recovered():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.core_v1 = MagicMock()
    
    # 3 desired replicas, 3 ready replicas
    mock_dep = create_mock_deployment(desired=3, ready=3)
    mock_dep_list = MagicMock()
    mock_dep_list.items = [mock_dep]
    k8s_service.apps_v1.list_namespaced_deployment.return_value = mock_dep_list
    
    # New replacement pod is running
    mock_new_pod = create_mock_pod(name="kubepulse-sample-new-pod", ready=True)
    mock_pod_list = MagicMock()
    mock_pod_list.items = [mock_new_pod]
    k8s_service.core_v1.list_namespaced_pod.return_value = mock_pod_list
    
    response = client.get("/api/deployments/kubepulse-sample/self-healing-status?deleted_pod=kubepulse-sample-old-pod")
    assert response.status_code == 200
    data = response.json()
    assert data["deleted_pod"] == "kubepulse-sample-old-pod"
    assert data["is_deleted"] is True
    assert data["replacement_pod"] == "kubepulse-sample-new-pod"
    assert data["is_recovered"] is True
    assert data["desired_replicas"] == 3
    assert data["ready_replicas"] == 3


# -----------------------------------------------------------------------------
# 10. REAL RESOURCE METRICS & MISSING METRICS API
# -----------------------------------------------------------------------------
def test_missing_metrics_api():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.core_v1 = MagicMock()
    k8s_service.custom_objects = MagicMock()
    
    mock_dep_list = MagicMock()
    mock_dep_list.items = [create_mock_deployment(desired=1, ready=1)]
    k8s_service.apps_v1.list_namespaced_deployment.return_value = mock_dep_list
    
    mock_pod_list = MagicMock()
    mock_pod_list.items = [create_mock_pod(ready=True)]
    k8s_service.core_v1.list_namespaced_pod.return_value = mock_pod_list
    
    # CustomObjectsApi raises 404 for metrics.k8s.io (Metrics Server not installed)
    k8s_service.custom_objects.list_namespaced_custom_object.side_effect = ApiException(status=404, reason="Not Found")
    
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["metrics_available"] is False
    assert "Metrics Server" in data["metrics_message"]
    assert data["pod_resources"] == []

def test_metrics_api_success():
    k8s_service.is_connected = True
    k8s_service.apps_v1 = MagicMock()
    k8s_service.core_v1 = MagicMock()
    k8s_service.custom_objects = MagicMock()
    
    mock_dep_list = MagicMock()
    mock_dep_list.items = [create_mock_deployment(desired=1, ready=1)]
    k8s_service.apps_v1.list_namespaced_deployment.return_value = mock_dep_list
    
    mock_pod_list = MagicMock()
    mock_pod_list.items = [create_mock_pod(name="kubepulse-sample-pod-1", ready=True)]
    k8s_service.core_v1.list_namespaced_pod.return_value = mock_pod_list
    
    # Real metrics data from metrics.k8s.io/v1beta1
    k8s_service.custom_objects.list_namespaced_custom_object.return_value = {
        "items": [{
            "metadata": {"name": "kubepulse-sample-pod-1"},
            "containers": [{
                "name": "kubepulse-sample",
                "usage": {"cpu": "25m", "memory": "64Mi"}
            }]
        }]
    }
    
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["metrics_available"] is True
    assert len(data["pod_resources"]) == 1
    res = data["pod_resources"][0]
    assert res["pod_name"] == "kubepulse-sample-pod-1"
    assert res["cpu"] == "25m"
    assert res["memory"] == "64Mi"


# -----------------------------------------------------------------------------
# 11. DEMO RUNNER DISCONNECTED STATE REPORTING
# -----------------------------------------------------------------------------
def test_demo_runner_reports_truthful_failure_when_disconnected():
    with patch.object(k8s_service, "connect", return_value=False):
        k8s_service.is_connected = False
        k8s_service.error_details = "API server offline"
        
        response = client.post("/api/demo/run-step/1")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert "disconnected" in data["actual_result"].lower()
    k8s_service.connect()


# -----------------------------------------------------------------------------
# 12. ROBUST KUBECONFIG RESOLUTION & CONNECTION TESTS
# -----------------------------------------------------------------------------
import os
from app.services.k8s_client import KubernetesService

def test_missing_kubeconfig_explicit_path(tmp_path):
    non_existent = str(tmp_path / "does_not_exist.yaml")
    service = KubernetesService(kubeconfig_path=non_existent)
    assert service.is_connected is False
    assert "Configured kubeconfig file not found" in service.error_details
    assert service.resolved_kubeconfig_path == os.path.abspath(non_existent)

def test_empty_kubeconfig_file(tmp_path):
    empty_file = tmp_path / "empty_config.yaml"
    empty_file.write_text("", encoding="utf-8")
    service = KubernetesService(kubeconfig_path=str(empty_file))
    assert service.is_connected is False
    assert "empty (0 bytes)" in service.error_details

def test_corrupted_yaml_kubeconfig(tmp_path):
    corrupted_file = tmp_path / "corrupted.yaml"
    corrupted_file.write_text("apiVersion: v1\nclusters: [unclosed bracket", encoding="utf-8")
    service = KubernetesService(kubeconfig_path=str(corrupted_file))
    assert service.is_connected is False
    assert "corrupted or invalid YAML" in service.error_details

def test_context_selection_not_found(tmp_path):
    valid_cfg = """
apiVersion: v1
clusters:
- cluster: {server: 'https://127.0.0.1:6443'}
  name: local-cluster
contexts:
- context: {cluster: local-cluster, user: test-user}
  name: dev-context
current-context: dev-context
users:
- name: test-user
  user: {token: my-secret-token}
"""
    cfg_file = tmp_path / "valid_cfg.yaml"
    cfg_file.write_text(valid_cfg, encoding="utf-8")
    
    # Request a non-existent context
    service = KubernetesService(kubeconfig_path=str(cfg_file), kubeconfig_context="prod-cluster")
    assert service.is_connected is False
    assert "Requested context 'prod-cluster' was not found" in service.error_details
    assert "dev-context" in service.error_details

def test_no_current_context_in_kubeconfig(tmp_path):
    no_curr = """
apiVersion: v1
clusters:
- cluster: {server: 'https://127.0.0.1:6443'}
  name: local-cluster
contexts:
- context: {cluster: local-cluster, user: test-user}
  name: dev-context
users:
- name: test-user
  user: {token: test}
"""
    cfg_file = tmp_path / "no_curr.yaml"
    cfg_file.write_text(no_curr, encoding="utf-8")
    
    service = KubernetesService(kubeconfig_path=str(cfg_file))
    assert service.is_connected is False
    assert "No active 'current-context' is set" in service.error_details

def test_successful_connection_with_context(tmp_path):
    valid_cfg = """
apiVersion: v1
clusters:
- cluster: {server: 'https://127.0.0.1:6443'}
  name: test-cluster
contexts:
- context: {cluster: test-cluster, user: admin}
  name: minikube
current-context: minikube
users:
- name: admin
  user: {token: fake-token}
"""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(valid_cfg, encoding="utf-8")
    
    with patch("kubernetes.config.load_kube_config"), \
         patch("kubernetes.client.VersionApi") as mock_version_api, \
         patch("kubernetes.client.CoreV1Api") as mock_core:
        
        mock_v_inst = MagicMock()
        mock_v_info = MagicMock()
        mock_v_info.major = "1"
        mock_v_info.minor = "28"
        mock_v_inst.get_code.return_value = mock_v_info
        mock_version_api.return_value = mock_v_inst
        
        mock_core_inst = MagicMock()
        mock_core.return_value = mock_core_inst
        
        service = KubernetesService(kubeconfig_path=str(cfg_file))
        assert service.is_connected is True
        assert service.cluster_name == "test-cluster"
        assert service.current_context == "minikube"
        assert service.server_version == "v1.28"
        assert service.error_details is None

def test_unreachable_api_server_connection_refused(tmp_path):
    valid_cfg = """
apiVersion: v1
clusters:
- cluster: {server: 'https://127.0.0.1:6443'}
  name: test-cluster
contexts:
- context: {cluster: test-cluster, user: admin}
  name: minikube
current-context: minikube
users:
- name: admin
  user: {token: fake}
"""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(valid_cfg, encoding="utf-8")
    
    with patch("kubernetes.config.load_kube_config"), \
         patch("kubernetes.client.VersionApi") as mock_version_api:
        mock_v = MagicMock()
        mock_v.get_code.side_effect = Exception("MaxRetryError: Failed to establish a new connection: [WinError 10061] No connection could be made because the target machine actively refused it")
        mock_version_api.return_value = mock_v
        
        service = KubernetesService(kubeconfig_path=str(cfg_file))
        assert service.is_connected is False
        assert "Cannot reach Kubernetes API server" in service.error_details

def test_authentication_failure_401(tmp_path):
    valid_cfg = """
apiVersion: v1
clusters:
- cluster: {server: 'https://127.0.0.1:6443'}
  name: secured-cluster
contexts:
- context: {cluster: secured-cluster, user: expired-user}
  name: secured-context
current-context: secured-context
users:
- name: expired-user
  user: {token: expired}
"""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(valid_cfg, encoding="utf-8")
    
    with patch("kubernetes.config.load_kube_config"), \
         patch("kubernetes.client.VersionApi") as mock_version_api:
        mock_v = MagicMock()
        mock_v.get_code.side_effect = ApiException(status=401, reason="Unauthorized")
        mock_version_api.return_value = mock_v
        
        service = KubernetesService(kubeconfig_path=str(cfg_file))
        assert service.is_connected is False
        assert "Authentication failed" in service.error_details
        assert "HTTP 401" in service.error_details

def test_authorization_failure_403(tmp_path):
    valid_cfg = """
apiVersion: v1
clusters:
- cluster: {server: 'https://127.0.0.1:6443'}
  name: secured-cluster
contexts:
- context: {cluster: secured-cluster, user: unpriv-user}
  name: secured-context
current-context: secured-context
users:
- name: unpriv-user
  user: {token: unpriv}
"""
    cfg_file = tmp_path / "config.yaml"
    cfg_file.write_text(valid_cfg, encoding="utf-8")
    
    with patch("kubernetes.config.load_kube_config"), \
         patch("kubernetes.client.VersionApi") as mock_version_api:
        mock_v = MagicMock()
        mock_v.get_code.side_effect = ApiException(status=403, reason="Forbidden")
        mock_version_api.return_value = mock_v
        
        service = KubernetesService(kubeconfig_path=str(cfg_file))
        assert service.is_connected is False
        assert "Authorization failed" in service.error_details
        assert "HTTP 403" in service.error_details

def test_error_sanitization_masks_secrets():
    raw_error = "Error connecting: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret token=secret-token-1234 client-key-data=LS0tLS1CRUdJTi password='supersecretpassword'"
    sanitized = KubernetesService._sanitize_error(raw_error)
    assert "Bearer [REDACTED]" in sanitized
    assert "eyJhbG" not in sanitized
    assert "token: [REDACTED]" in sanitized
    assert "secret-token-1234" not in sanitized
    assert "client-key-data: [REDACTED]" in sanitized
    assert "LS0tLS1" not in sanitized
    assert "password: [REDACTED]" in sanitized
    assert "supersecretpassword" not in sanitized

