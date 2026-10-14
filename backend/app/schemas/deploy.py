from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, Field

DeploySourceType = Literal["git", "image", "website"]

class DeployInputRequest(BaseModel):
    source_type: DeploySourceType = Field(..., description="Type of input: 'git', 'image', or 'website'")
    app_name: str = Field(..., min_length=2, max_length=63, description="RFC 1123 application name")
    
    # Git repository input
    git_url: Optional[str] = Field(None, description="Git repository URL containing source code")
    branch: Optional[str] = Field("main", description="Git branch to clone")
    
    # Docker image input
    image_ref: Optional[str] = Field(None, description="Existing Docker image reference (e.g. 'nginx:alpine')")
    
    # Public website monitor input
    website_url: Optional[str] = Field(None, description="Public website URL for availability monitoring only")
    
    # Kubernetes deployment options
    container_port: int = Field(80, ge=1, le=65535, description="Target container application port")
    replicas: int = Field(1, ge=1, le=10, description="Desired replica count (1-10)")
    namespace: Optional[str] = Field(None, description="Target Kubernetes namespace")


class DeployInputResponse(BaseModel):
    success: bool
    app_name: str
    source_type: DeploySourceType
    is_deployed_to_k8s: bool
    deployment_name: Optional[str] = None
    service_name: Optional[str] = None
    service_port: Optional[int] = None
    image: Optional[str] = None
    replicas: Optional[int] = None
    status: str
    message: str
    details: Optional[Dict[str, Any]] = None


class WebsiteMonitorCheckResult(BaseModel):
    timestamp: str
    status_code: Optional[int] = None
    latency_ms: Optional[float] = None
    is_up: bool
    error: Optional[str] = None


class WebsiteMonitorItem(BaseModel):
    name: str
    url: str
    is_available: bool
    status_code: Optional[int] = None
    latency_ms: Optional[float] = None
    error: Optional[str] = None
    last_checked: str
    is_deployed_to_k8s: bool = False
    notice: str = "External availability monitor only. This URL is NOT running as a workload inside the Kubernetes cluster."
    history: List[WebsiteMonitorCheckResult] = Field(default_factory=list)


class WorkloadDeleteResponse(BaseModel):
    success: bool
    app_name: str
    namespace: str
    deleted_deployment: bool
    deleted_service: bool
    message: str
