from fastapi import APIRouter, Query
from typing import Optional
from app.schemas.k8s import MetricsResponse
from app.services.k8s_client import k8s_service

router = APIRouter(prefix="/api/metrics", tags=["Metrics"])

@router.get("", response_model=MetricsResponse)
async def get_metrics(namespace: Optional[str] = Query(None)):
    """
    Get actual pod replica counts and real resource usage from Kubernetes Metrics API.
    Does not invent data if metrics API is unavailable.
    """
    return k8s_service.get_metrics(namespace)
