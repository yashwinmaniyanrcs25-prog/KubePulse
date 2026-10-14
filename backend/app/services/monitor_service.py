import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional, Any
import httpx
from app.services.security import validate_safe_url, validate_dns_name

logger = logging.getLogger("kubepulse.monitors")

class WebsiteMonitorService:
    """
    Manages external public website availability monitoring.
    Explicitly decoupled from Kubernetes deployments: does not claim
    external URLs are deployed inside the cluster.
    """
    def __init__(self):
        self._monitors: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def add_monitor(self, name: str, url: str) -> Dict[str, Any]:
        """
        Validates URL and registers a new website availability monitor.
        Immediately executes a live probe to establish initial availability.
        """
        clean_name = validate_dns_name(name)
        safe_url = validate_safe_url(url)

        probe_result = await self._probe_url(safe_url)
        now_iso = datetime.now(timezone.utc).isoformat()

        monitor_record = {
            "name": clean_name,
            "url": safe_url,
            "is_available": probe_result["is_up"],
            "status_code": probe_result["status_code"],
            "latency_ms": probe_result["latency_ms"],
            "error": probe_result["error"],
            "last_checked": now_iso,
            "is_deployed_to_k8s": False,
            "notice": "External availability monitor only. This URL is NOT running as a workload inside the Kubernetes cluster.",
            "history": [
                {
                    "timestamp": now_iso,
                    "status_code": probe_result["status_code"],
                    "latency_ms": probe_result["latency_ms"],
                    "is_up": probe_result["is_up"],
                    "error": probe_result["error"]
                }
            ]
        }

        async with self._lock:
            self._monitors[clean_name] = monitor_record

        logger.info(f"Registered external monitor for '{clean_name}' -> {safe_url} (Up: {probe_result['is_up']})")
        return monitor_record

    async def check_monitor(self, name: str) -> Dict[str, Any]:
        """Executes an authentic on-demand probe for an existing monitor."""
        async with self._lock:
            monitor = self._monitors.get(name)
            if not monitor:
                raise KeyError(f"Monitor '{name}' not found.")

        safe_url = monitor["url"]
        probe_result = await self._probe_url(safe_url)
        now_iso = datetime.now(timezone.utc).isoformat()

        history_entry = {
            "timestamp": now_iso,
            "status_code": probe_result["status_code"],
            "latency_ms": probe_result["latency_ms"],
            "is_up": probe_result["is_up"],
            "error": probe_result["error"]
        }

        async with self._lock:
            monitor["is_available"] = probe_result["is_up"]
            monitor["status_code"] = probe_result["status_code"]
            monitor["latency_ms"] = probe_result["latency_ms"]
            monitor["error"] = probe_result["error"]
            monitor["last_checked"] = now_iso
            monitor["history"].append(history_entry)
            if len(monitor["history"]) > 20:
                monitor["history"].pop(0)

        return monitor

    async def list_monitors(self) -> List[Dict[str, Any]]:
        """Returns all configured external website monitors."""
        async with self._lock:
            return list(self._monitors.values())

    async def get_monitor(self, name: str) -> Optional[Dict[str, Any]]:
        async with self._lock:
            return self._monitors.get(name)

    async def delete_monitor(self, name: str) -> bool:
        async with self._lock:
            if name in self._monitors:
                del self._monitors[name]
                return True
            return False

    async def _probe_url(self, url: str) -> Dict[str, Any]:
        """Executes a real HTTP/HTTPS request with strict timeout."""
        try:
            # Enforce safe URL again before actual HTTP request
            validate_safe_url(url)
            start_time = asyncio.get_event_loop().time()
            async with httpx.AsyncClient(timeout=5.0, follow_redirects=True) as client:
                response = await client.get(url)
                latency = round((asyncio.get_event_loop().time() - start_time) * 1000, 2)
                
                is_up = response.status_code < 400
                error_msg = None if is_up else f"HTTP {response.status_code} {response.reason_phrase}"
                
                return {
                    "is_up": is_up,
                    "status_code": response.status_code,
                    "latency_ms": latency,
                    "error": error_msg
                }
        except Exception as e:
            logger.warning(f"Failed to probe {url}: {e}")
            return {
                "is_up": False,
                "status_code": None,
                "latency_ms": None,
                "error": str(e)
            }

monitor_service = WebsiteMonitorService()
