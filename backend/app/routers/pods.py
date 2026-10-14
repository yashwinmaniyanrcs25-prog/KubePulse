from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.schemas.k8s import PodItem, DeletePodResponse
from app.services.k8s_client import k8s_service

router = APIRouter(prefix="/api/pods", tags=["Pods"])

@router.get("", response_model=List[PodItem])
async def list_pods(namespace: Optional[str] = Query(None)):
    """List pods in the specified namespace from the real Kubernetes cluster."""
    try:
        return k8s_service.list_pods(namespace)
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.get("/{name}", response_model=PodItem)
async def get_pod(name: str, namespace: Optional[str] = Query(None)):
    """Get single pod details from real cluster."""
    try:
        pod = k8s_service.get_pod(name, namespace)
        if not pod:
            raise HTTPException(status_code=404, detail=f"Pod '{name}' not found.")
        return pod
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.delete("/{name}", response_model=DeletePodResponse)
async def delete_pod_for_recovery_test(name: str, namespace: Optional[str] = Query(None)):
    """
    Self-healing demonstration action: Deletes a specific managed pod from Kubernetes.
    Validates ownership guardrails and initiates real Kubernetes reconciliation.
    """
    try:
        result = await k8s_service.delete_pod_for_recovery_test(pod_name=name, namespace=namespace)
        return result
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
