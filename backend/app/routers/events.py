from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from app.schemas.k8s import EventItem
from app.services.k8s_client import k8s_service

router = APIRouter(prefix="/api/events", tags=["Events"])

@router.get("", response_model=List[EventItem])
async def list_events(namespace: Optional[str] = Query(None)):
    """List cluster events from real Kubernetes cluster."""
    try:
        return k8s_service.list_events(namespace)
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))
