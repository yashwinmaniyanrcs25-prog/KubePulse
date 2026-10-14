from fastapi import APIRouter, HTTPException, Path
from typing import List
from app.schemas.deploy import WebsiteMonitorItem
from app.services.monitor_service import monitor_service

router = APIRouter(prefix="/api/monitors", tags=["Website Availability Monitors"])

@router.get("", response_model=List[WebsiteMonitorItem])
async def list_monitors():
    """
    Lists all external website availability monitors.
    Explicitly decoupled from Kubernetes: displays external URL health, latency,
    and HTTP response status without claiming workloads are deployed to the cluster.
    """
    return await monitor_service.list_monitors()

@router.post("/{name}/check", response_model=WebsiteMonitorItem)
async def check_monitor(name: str = Path(..., description="Monitor identifier")):
    """Executes a real-time HTTP availability probe against the monitored website."""
    try:
        return await monitor_service.check_monitor(name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Website monitor '{name}' not found.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Probe execution error: {str(e)}")

@router.delete("/{name}")
async def delete_monitor(name: str = Path(..., description="Monitor identifier")):
    """Removes a website from availability monitoring."""
    deleted = await monitor_service.delete_monitor(name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Website monitor '{name}' not found.")
    return {"success": True, "message": f"Website monitor '{name}' removed."}
