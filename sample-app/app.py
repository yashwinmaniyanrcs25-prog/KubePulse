import os
import sys
import time
import logging
from datetime import datetime, timezone
from fastapi import FastAPI, Response, status
from fastapi.responses import HTMLResponse, JSONResponse

# Configure structured logging to stdout/stderr
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [pod:%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("kubepulse-sample")

# Application state
app_start_time = time.time()
is_healthy = True
is_ready = True

# Read environment variables injected via Kubernetes Downward API
POD_NAME = os.getenv("POD_NAME", "kubepulse-sample-local-dev")
POD_NAMESPACE = os.getenv("POD_NAMESPACE", "kubepulse")
POD_IP = os.getenv("POD_IP", "127.0.0.1")
NODE_NAME = os.getenv("NODE_NAME", "minikube-worker-01")
APP_VERSION = os.getenv("APP_VERSION", "v1.0.0")

app = FastAPI(
    title="KubePulse Demo Application",
    description="Sample containerized microservice running on Kubernetes with Downward API & probe endpoints",
    version=APP_VERSION,
)

@app.on_event("startup")
async def startup_event():
    logger.info(f"KubePulse Demo Application starting on pod '{POD_NAME}' (namespace: {POD_NAMESPACE}, IP: {POD_IP})")

@app.get("/", response_class=HTMLResponse)
async def home():
    """Home page identifying the application and current pod identity."""
    uptime = round(time.time() - app_start_time, 1)
    status_color = "#10b981" if is_healthy and is_ready else "#ef4444"
    status_label = "HEALTHY & READY" if is_healthy and is_ready else "DEGRADED"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>KubePulse Demo Application</title>
    <style>
        body {{
            margin: 0;
            padding: 40px 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background: #0B0F19;
            color: #F8FAFC;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            box-sizing: border-box;
        }}
        .card {{
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 16px;
            padding: 36px;
            max-width: 640px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(16, 185, 129, 0.1);
        }}
        .badge {{
            display: inline-block;
            background: rgba(16, 185, 129, 0.15);
            border: 1px solid {status_color};
            color: {status_color};
            padding: 6px 14px;
            border-radius: 9999px;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.05em;
            text-transform: uppercase;
            margin-bottom: 20px;
        }}
        h1 {{
            font-size: 26px;
            margin: 0 0 10px 0;
            color: #F8FAFC;
        }}
        p.subtitle {{
            color: #94A3B8;
            font-size: 15px;
            margin-bottom: 28px;
        }}
        .grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 28px;
        }}
        .metric-box {{
            background: #090D16;
            border: 1px solid #1E293B;
            border-radius: 10px;
            padding: 14px 18px;
        }}
        .metric-label {{
            font-size: 12px;
            color: #64748B;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }}
        .metric-value {{
            font-size: 16px;
            color: #38BDF8;
            font-weight: 600;
            word-break: break-all;
        }}
        .endpoints {{
            border-top: 1px solid #1E293B;
            padding-top: 20px;
        }}
        .endpoint-link {{
            display: inline-block;
            margin-right: 12px;
            color: #10B981;
            text-decoration: none;
            font-size: 14px;
            background: #111827;
            padding: 6px 12px;
            border-radius: 6px;
            border: 1px solid #1F2937;
        }}
        .endpoint-link:hover {{
            background: #1F2937;
            color: #34D399;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="badge">{status_label}</div>
        <h1>KubePulse Demo Application</h1>
        <p class="subtitle">Kubernetes Self-Healing & Scaling Demo Workload</p>

        <div class="grid">
            <div class="metric-box">
                <div class="metric-label">Pod Identity (Downward API)</div>
                <div class="metric-value">{POD_NAME}</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Namespace</div>
                <div class="metric-value">{POD_NAMESPACE}</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Pod IP Address</div>
                <div class="metric-value">{POD_IP}</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Node Name</div>
                <div class="metric-value">{NODE_NAME}</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Uptime</div>
                <div class="metric-value">{uptime}s</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">Version</div>
                <div class="metric-value">{APP_VERSION}</div>
            </div>
        </div>

        <div class="endpoints">
            <span style="font-size: 13px; color: #64748B; margin-right: 10px;">Probe Endpoints:</span>
            <a class="endpoint-link" href="/health">/health (JSON)</a>
            <a class="endpoint-link" href="/ready">/ready</a>
            <a class="endpoint-link" href="/live">/live</a>
        </div>
    </div>
</body>
</html>
"""
    return HTMLResponse(content=html_content)

@app.get("/health")
async def health():
    """Readiness/Liveness primary probe endpoint returning status and metadata."""
    uptime = round(time.time() - app_start_time, 2)
    payload = {
        "status": "healthy" if (is_healthy and is_ready) else "unhealthy",
        "app": "KubePulse Demo Application",
        "version": APP_VERSION,
        "pod_name": POD_NAME,
        "namespace": POD_NAMESPACE,
        "pod_ip": POD_IP,
        "uptime_seconds": uptime,
        "probes": {
            "liveness": "passing" if is_healthy else "failing",
            "readiness": "ready" if is_ready else "not_ready",
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if not is_healthy:
        logger.warning(f"Health check failed on pod {POD_NAME} (liveness failure)")
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)
    if not is_ready:
        logger.warning(f"Readiness check failed on pod {POD_NAME} (not ready for traffic)")
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=payload)
    return JSONResponse(status_code=status.HTTP_200_OK, content=payload)

@app.get("/ready")
async def ready_probe():
    """Specific Kubernetes Readiness Probe endpoint."""
    if not is_ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "pod": POD_NAME}
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "ready", "pod": POD_NAME}
    )

@app.get("/live")
async def live_probe():
    """Specific Kubernetes Liveness Probe endpoint."""
    if not is_healthy:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "dead", "pod": POD_NAME}
        )
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"status": "alive", "pod": POD_NAME}
    )

@app.post("/health/toggle")
async def toggle_health(probe_type: str = "readiness", state: bool = False):
    """
    Demonstration helper to safely simulate probe failure (Test D).
    Allows testing container restart or traffic detachment without crashing node.
    """
    global is_healthy, is_ready
    if probe_type == "liveness":
        is_healthy = state
        logger.info(f"Pod {POD_NAME} simulated liveness set to: {is_healthy}")
    else:
        is_ready = state
        logger.info(f"Pod {POD_NAME} simulated readiness set to: {is_ready}")
    return {
        "pod": POD_NAME,
        "probe_toggled": probe_type,
        "new_state": state,
        "message": f"{probe_type} state set to {state}"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
