from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas.k8s import DeploymentItem, ScaleRequest, ScaleResponse, RolloutStatus, SelfHealingObservation
from app.services.k8s_client import k8s_service

router = APIRouter(prefix="/api/deployments", tags=["Deployments"])

@router.get("", response_model=List[DeploymentItem])
async def list_deployments(namespace: Optional[str] = Query(None)):
    """List Kubernetes Deployments in namespace from real cluster."""
    try:
        return k8s_service.list_deployments(namespace)
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.get("/{name}", response_model=DeploymentItem)
async def get_deployment(name: str, namespace: Optional[str] = Query(None)):
    """Get detailed state of a specific real Deployment."""
    try:
        dep = k8s_service.get_deployment(name, namespace)
        if not dep:
            raise HTTPException(status_code=404, detail=f"Deployment '{name}' not found.")
        return dep
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.get("/{name}/rollout", response_model=RolloutStatus)
async def get_rollout_status(name: str, namespace: Optional[str] = Query(None)):
    """Get real rollout progression and readiness status for a Deployment."""
    try:
        return k8s_service.get_rollout_status(name, namespace)
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.patch("/{name}/scale", response_model=ScaleResponse)
async def scale_deployment(name: str, payload: ScaleRequest, namespace: Optional[str] = Query(None)):
    """
    Scale a deployment's replica count via real Kubernetes API.
    Validates replica bounds (0-10) and updates the live Deployment.
    """
    try:
        res = await k8s_service.scale_deployment(name=name, replicas=payload.replicas, namespace=namespace)
        return res
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.get("/{name}/self-healing-status", response_model=SelfHealingObservation)
async def get_self_healing_status(name: str, deleted_pod: str, namespace: Optional[str] = Query(None)):
    """
    Observes real cluster state to verify whether Kubernetes has recovered
    from a deleted pod and restored the desired replica count.
    """
    try:
        return k8s_service.observe_self_healing(deleted_pod_name=deleted_pod, namespace=namespace)
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
