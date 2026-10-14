import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import cluster, deployments, pods, services, events, metrics, demo, deploy_input, monitors
from app.services.k8s_client import k8s_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("kubepulse.api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Target Workload: {settings.TARGET_NAMESPACE}/{settings.TARGET_DEPLOYMENT}")
    # Trigger initial connection check
    k8s_service.connect()
    yield
    logger.info("Shutting down KubePulse backend")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API Gateway for KubePulse — Kubernetes Self-Healing & Scaling Dashboard",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits frontend dev server on any local port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(cluster.router)
app.include_router(deployments.router)
app.include_router(deploy_input.router)
app.include_router(monitors.router)
app.include_router(pods.router)
app.include_router(services.router)
app.include_router(events.router)
app.include_router(metrics.router)
app.include_router(demo.router)

@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "operational",
        "docs_url": "/docs",
        "api_endpoints": [
            "/api/health",
            "/api/cluster/status",
            "/api/namespaces",
            "/api/deployments",
            "/api/deployments/deploy-input",
            "/api/monitors",
            "/api/pods",
            "/api/services",
            "/api/events",
            "/api/metrics",
            "/api/demo/stages",
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.KUBEPULSE_HOST, port=settings.KUBEPULSE_PORT, reload=True)
