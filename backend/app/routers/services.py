from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
import httpx
from app.schemas.k8s import ServiceItem, EndpointTestResponse
from app.services.k8s_client import k8s_service

router = APIRouter(prefix="/api/services", tags=["Services"])

@router.get("", response_model=List[ServiceItem])
async def list_services(namespace: Optional[str] = Query(None)):
    """List Kubernetes Services in namespace from real cluster."""
    try:
        return k8s_service.list_services(namespace)
    except ConnectionError as ce:
        raise HTTPException(status_code=503, detail=str(ce))
    except RuntimeError as re:
        raise HTTPException(status_code=502, detail=str(re))

@router.get("/{name}/test-endpoint", response_model=EndpointTestResponse)
async def test_service_endpoint(name: str, port: int = 8000, target_url: Optional[str] = None):
    """
    Tests application endpoint via genuine HTTP request.
    Connects to target URL (e.g. localhost:8000/health).
    If unreachable, returns truthful failure details without fabricating responses.
    """
    url = target_url or f"http://127.0.0.1:{port}/health"
    try:
        async with httpx.AsyncClient(timeout=2.5) as client:
            resp = await client.get(url)
            body = None
            try:
                body = resp.json()
            except Exception:
                body = resp.text

            return EndpointTestResponse(
                success=(resp.status_code == 200),
                url=url,
                status_code=resp.status_code,
                body=body,
                latency_ms=round(resp.elapsed.total_seconds() * 1000, 2),
                error=None if resp.status_code == 200 else f"HTTP {resp.status_code}"
            )
    except Exception as e:
        return EndpointTestResponse(
            success=False,
            url=url,
            status_code=None,
            body=None,
            latency_ms=None,
            error=f"Cannot connect to {url}: {str(e)}. Ensure port-forward is active: 'kubectl port-forward svc/{name} 8000:80 -n kubepulse'"
        )
