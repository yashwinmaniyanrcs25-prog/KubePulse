from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ClusterStatus(BaseModel):
    is_connected: bool
    cluster_status: str  # "connected" or "disconnected"
    cluster_name: str
    server_version: Optional[str] = None
    auth_type: str  # "kubeconfig", "in-cluster", "none"
    current_context: Optional[str] = None
    node_count: int = 0
    active_namespace: str
    target_deployment: str
    reachable: bool
    error_details: Optional[str] = None
    message: str
    kubeconfig_path: Optional[str] = None
    available_contexts: List[str] = Field(default_factory=list)

class NamespaceItem(BaseModel):
    name: str
    status: str
    age_seconds: int

class ProbeConfig(BaseModel):
    path: str
    port: int
    initial_delay_seconds: int
    period_seconds: int
    timeout_seconds: int
    failure_threshold: int

class PodItem(BaseModel):
    name: str
    namespace: str
    phase: str  # Pending, Running, Succeeded, Failed, Terminating, Unknown
    ready: bool
    ready_containers: str  # e.g., "1/1"
    restart_count: int
    age_seconds: int
    pod_ip: Optional[str] = None
    node_name: Optional[str] = None
    owning_deployment: Optional[str] = None
    owning_replicaset: Optional[str] = None
    liveness_probe_status: str  # "healthy", "failing", "not_configured"
    readiness_probe_status: str  # "ready", "not_ready", "not_configured"
    is_protected: bool = False
    labels: Dict[str, str] = Field(default_factory=dict)
    containers: List[Dict[str, Any]] = Field(default_factory=list)
    cpu_usage: Optional[str] = None
    memory_usage: Optional[str] = None

class DeploymentItem(BaseModel):
    name: str
    namespace: str
    desired_replicas: int
    available_replicas: int
    ready_replicas: int
    updated_replicas: int
    image: str
    strategy: str
    selector: Dict[str, str]
    created_at: str
    conditions: List[Dict[str, Any]] = Field(default_factory=list)
    probes: Dict[str, Any] = Field(default_factory=dict)

class ServiceItem(BaseModel):
    name: str
    namespace: str
    type: str
    cluster_ip: Optional[str] = None
    external_ip: Optional[str] = None
    ports: List[Dict[str, Any]]
    selector: Dict[str, str]
    age_seconds: int
    endpoint_status: str

class EventItem(BaseModel):
    id: str
    timestamp: str
    type: str  # Normal, Warning
    reason: str  # Scheduled, Pulling, Pulled, Created, Started, Killing, ScalingReplicaSet, Unhealthy
    message: str
    object_kind: str
    object_name: str
    namespace: str
    count: int = 1

class ScaleRequest(BaseModel):
    replicas: int = Field(ge=0, le=10, description="Target replica count (0-10)")

class ScaleResponse(BaseModel):
    success: bool
    deployment_name: str
    namespace: str
    previous_replicas: int
    target_replicas: int
    status: str
    message: str

class RolloutStatus(BaseModel):
    deployment_name: str
    namespace: str
    desired_replicas: int
    updated_replicas: int
    ready_replicas: int
    available_replicas: int
    is_complete: bool
    status_message: str

class MetricPoint(BaseModel):
    timestamp: str
    desired_replicas: int
    available_replicas: int
    running_pods: int
    unhealthy_pods: int

class PodResourceUsage(BaseModel):
    pod_name: str
    cpu: str
    memory: str

class MetricsResponse(BaseModel):
    metrics_available: bool
    metrics_source: Optional[str] = None
    metrics_message: Optional[str] = None
    current_desired: Optional[int] = None
    current_available: Optional[int] = None
    running_pods: Optional[int] = None
    unhealthy_pods: Optional[int] = None
    pod_resources: List[PodResourceUsage] = Field(default_factory=list)
    history: List[MetricPoint] = Field(default_factory=list)

class DeletePodResponse(BaseModel):
    success: bool
    pod_name: str
    namespace: str
    owning_deployment: str
    action: str
    message: str
    replacement_expected: bool

class SelfHealingObservation(BaseModel):
    deleted_pod: str
    is_deleted: bool
    replacement_pod: Optional[str] = None
    replacement_phase: Optional[str] = None
    replacement_ready: bool = False
    desired_replicas: int
    ready_replicas: int
    is_recovered: bool
    message: str

class EndpointTestResponse(BaseModel):
    success: bool
    url: str
    status_code: Optional[int] = None
    body: Optional[Any] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None

class DemoStage(BaseModel):
    stage_id: int
    title: str
    description: str
    command: str
    expected_result: str
    actual_result: Optional[str] = None
    status: str  # "pending", "running", "passed", "failed"
