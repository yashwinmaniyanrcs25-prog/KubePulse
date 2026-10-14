from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "KubePulse — Kubernetes Self-Healing & Scaling Backend"
    APP_VERSION: str = "1.0.0"
    KUBEPULSE_ENV: str = "development"
    KUBEPULSE_PORT: int = 8001
    KUBEPULSE_HOST: str = "0.0.0.0"
    
    # Target Kubernetes workload defaults
    TARGET_NAMESPACE: str = "kubepulse"
    TARGET_DEPLOYMENT: str = "kubepulse-sample"
    
    # Custom kubeconfig path if specified (supports KUBECONFIG_PATH or KUBECONFIG)
    KUBECONFIG_PATH: str = ""
    KUBECONFIG_CONTEXT: str = ""
    
    # Allowed CORS origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

    model_config = SettingsConfigDict(env_file=".env", extra="allow")

settings = Settings()
