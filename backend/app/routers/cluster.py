from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.schemas.k8s import ClusterStatus, NamespaceItem
from app.services.k8s_client import k8s_service

router = APIRouter(prefix="/api", tags=["Cluster"])

@router.get("/health", response_model=Dict[str, Any])
async def health_check():
    """Liveness health check for KubePulse backend gateway."""
    status = k8s_service.get_cluster_status()
    return {
        "status": "healthy",
        "service": "KubePulse API Gateway",
        "k8s_connected": status["is_connected"],
        "cluster_status": status["cluster_status"],
        "cluster_name": status["cluster_name"],
    }

@router.get("/cluster/status", response_model=ClusterStatus)
async def get_cluster_status():
    """Returns actual Kubernetes cluster connectivity state."""
    return k8s_service.get_cluster_status()

@router.get("/namespaces", response_model=List[NamespaceItem])
async def get_namespaces():
    """List all reachable Kubernetes namespaces from the real cluster."""
    try:
        return k8s_service.list_namespaces()
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
