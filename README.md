# KubePulse — Kubernetes Self-Healing & Scaling Dashboard

> **DevOps Hackathon 2026 | Problem 8: Kubernetes Application Deployment and Scaling**  
> An executive-grade, production-conscious Kubernetes management dashboard with authentic self-healing verification, horizontal replica scaling controls, readiness/liveness probe telemetry, and automated guided demonstration.

---

## 1. Project Overview & Architecture

**KubePulse** directly addresses and satisfies every requirement of DevOps Hackathon Problem 8:
- **Deploy Containerized Application**: Sample FastAPI microservice containerized with non-root user (`UID 10001`), Downward API metadata injection, and health endpoints.
- **Kubernetes Manifests**: Complete suite of declarative YAMLs (Namespace, Deployment, Service, Least-privilege RBAC Role & RoleBinding, Kustomize bundle).
- **Probes**: Configured Startup (`/health`), Readiness (`/ready`), and Liveness (`/live`) HTTP probes with realistic thresholds.
- **Horizontal Scaling**: Interactive scale controls from 1 to 3 replicas with live rollout progression tracking via the official Kubernetes API.
- **Self-Healing Demonstration**: Guardrailed pod deletion action triggering automatic ReplicaSet reconciliation, monitored until replacement pods are ready.
- **Application Endpoint**: Service ClusterIP with verified HTTP endpoint inspector and curl reproduction steps.
- **Authentic Cluster Integration**: Built strictly on the official Kubernetes Python SDK (`kubernetes`). Every metric, count, condition, and event originates from live Kubernetes API responses. When disconnected, the application presents a truthful offline state with clear setup instructions, never fabricating simulated pods or fake metrics.

```
+-------------------------------------------------------------------------------+
|                             KUBEPULSE DASHBOARD                               |
|                  React 18 + Vite + TypeScript + Tailwind CSS                  |
|          (Dark Navy Obsidian, Emerald & Cyan Accents, Recharts Metrics)       |
+-------------------------------------------------------------------------------+
                                      ▲
                                      │ /api Proxy (Port 5173 -> 8080)
                                      ▼
+-------------------------------------------------------------------------------+
|                          KUBEPULSE BACKEND GATEWAY                            |
|                     Python 3.11+ / FastAPI / Uvicorn                          |
|             (Official Kubernetes SDK, Least-Privilege RBAC, Pytest)           |
+-------------------------------------------------------------------------------+
                                      │
                        Official Kubernetes Python SDK
                                      ▼
+-------------------------------------------------------------------------------+
|                       ACTIVE KUBERNETES CLUSTER (K8s)                         |
|                 Approved Remote Cluster / Minikube / kind / Cloud K8s         |
|                                                                               |
|  Namespace: `kubepulse`              Deployment: `kubepulse-sample`           |
|  Service: `kubepulse-sample-service`  RBAC: Least-privilege Role & Binding    |
|  Workload Pods: Downward API, Probes, Non-root User (UID 10001)               |
|  Metrics API: `metrics.k8s.io` (Real CPU/Memory when Metrics Server active)   |
+-------------------------------------------------------------------------------+
```

---

## 2. Directory Structure

```text
kubepulse/
├── backend/
│   ├── app/
│   │   ├── config.py              # Pydantic Settings and environment config
│   │   ├── main.py                # FastAPI app entrypoint, CORS, routers
│   │   ├── routers/
│   │   │   ├── cluster.py         # /api/health, /api/cluster/status, /api/namespaces
│   │   │   ├── deployments.py     # /api/deployments, /scale, /rollout, /self-healing-status
│   │   │   ├── pods.py            # /api/pods, /api/pods/{name} (Guardrailed DELETE)
│   │   │   ├── services.py        # /api/services, /test-endpoint
│   │   │   ├── events.py          # /api/events real chronological stream
│   │   │   ├── metrics.py         # /api/metrics real Metrics Server telemetry
│   │   │   └── demo.py            # 10-stage sequential hackathon demo runner
│   │   ├── schemas/               # Pydantic models (Cluster, Pod, Deployment, etc.)
│   │   └── services/              # KubernetesService using official SDK
│   ├── tests/
│   │   └── test_api.py            # Automated Pytest suite (28 unit test cases)
│   ├── Dockerfile                 # Backend container image (non-root UID 10002)
│   ├── requirements.txt           # Python dependencies (fastapi, kubernetes, pyyaml)
│   ├── pytest.ini                 # Pytest configuration
│   ├── .env                       # Local environment variables
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/            # Sidebar, TopNav, ConfirmModal, ScaleModal
│   │   ├── pages/                 # Overview, Workloads, Pods, Services, Probes, Demo, Guide, Settings
│   │   ├── services/api.ts        # Strongly typed API client (zero mock fallbacks)
│   │   ├── types/index.ts         # TypeScript models matching backend schemas
│   │   ├── index.css              # Custom styling, dark mode glassmorphism
│   │   ├── App.tsx                # Main application state and polling lifecycle
│   │   └── main.tsx
│   ├── package.json               # React, Vite, Lucide, Recharts, Tailwind
│   ├── vite.config.ts             # Vite build & reverse API proxy
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── .env.example
├── sample-app/
│   ├── app.py                     # Sample container workload (Downward API & probes)
│   ├── Dockerfile                 # Non-root user (UID 10001) container
│   ├── requirements.txt
│   └── .dockerignore
├── k8s/
│   ├── namespace.yaml             # Namespace: kubepulse
│   ├── deployment.yaml            # 1 replica, probes, resource limits, securityContext
│   ├── service.yaml               # ClusterIP (80 -> 8000)
│   ├── serviceaccount.yaml        # Least-privilege ServiceAccount
│   ├── role.yaml                  # Role scoped strictly to kubepulse namespace
│   ├── rolebinding.yaml           # Binding ServiceAccount to Role
│   ├── ingress.yaml               # Optional Ingress definition
│   └── kustomization.yaml         # Kustomize manifest bundle
├── scripts/
│   ├── build-image.ps1            # Builds sample Docker image and loads into cluster
│   ├── deploy.ps1                 # Deploys K8s manifests & awaits rollout
│   ├── scale.ps1                  # Scales deployment to 3 replicas
│   ├── verify.ps1                 # Automated verification of Tests A, B, C, D
│   └── cleanup.ps1                # Cleans up namespace
├── evidence/
│   └── README.md                  # Test evidence logs & verification audit
├── .gitignore
└── README.md
```

---

## 3. Kubernetes Connection Architecture & Discovery

### Understanding Client vs Cluster
> **Important Distinction:** `kubectl` is a command-line client used to interact with Kubernetes. Installing `kubectl` does **not** create a Kubernetes cluster. A cluster consists of an active control plane (API server, controller manager, scheduler, etcd) and worker nodes.

### Kubeconfig Resolution Order
KubePulse automatically resolves the Kubernetes configuration in the following order:
1. **Explicit Constructor Argument**: Passed programmatically when running automated unit tests.
2. **`KUBECONFIG_PATH` Environment Variable**: Configurable in `backend/.env` or via PowerShell session `$env:KUBECONFIG_PATH = "C:\path\to\cluster.kubeconfig"`.
3. **`KUBECONFIG` Standard Environment Variable**: Standard environment variable used by Kubernetes tools.
4. **Standard Windows Default Location**: `%USERPROFILE%\.kube\config` (`$HOME\.kube\config`).
5. **In-Cluster Configuration**: Active only when the backend runs inside a Kubernetes Pod with genuine service account tokens (`/var/run/secrets/kubernetes.io/serviceaccount`).

### Context Selection & Safety
- **Context Pinning**: The backend respects the active `current-context` defined in the kubeconfig, or an explicit context configured via `KUBECONFIG_CONTEXT` in `backend/.env` or `$env:KUBECONFIG_CONTEXT`.
- **No Silent Switching**: If a requested context is not found in the file, the backend reports an error listing available contexts rather than silently switching to an unintended cluster.
- **Live Verification**: A connection is reported as connected **only** after `client.VersionApi().get_code()` and `CoreV1Api.get_api_resources()` successfully respond. Mere existence of a kubeconfig file never marks the dashboard as connected.
- **Secret Sanitization**: Bearer tokens, passwords, and client certificates are stripped from all diagnostic logs and API responses.

---

## 4. Windows PowerShell Prerequisites Check

Open PowerShell and run this diagnostic check to inspect your system:

```powershell
# 1. Check if kubectl CLI is installed
if (Get-Command kubectl -ErrorAction SilentlyContinue) {
    kubectl version --client
} else {
    Write-Warning "kubectl is not installed or not in PATH."
    Write-Host "Note: kubectl is a client tool, not the cluster itself." -ForegroundColor Yellow
}

# 2. Check if Docker daemon is running
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker --version
} else {
    Write-Warning "Docker is not installed or not in PATH."
}

# 3. Check for standard kubeconfig file
$defaultKube = "$HOME\.kube\config"
if (Test-Path $defaultKube) {
    Write-Host "Found kubeconfig at: $defaultKube" -ForegroundColor Green
    if (Get-Command kubectl -ErrorAction SilentlyContinue) {
        Write-Host "Active Context: $(kubectl config current-context)" -ForegroundColor Green
    }
} else {
    Write-Warning "No kubeconfig found at: $defaultKube"
    Write-Host "Configure an approved cluster context or set `$env:KUBECONFIG_PATH" -ForegroundColor Yellow
}
```

---

## 5. Connecting an Approved Existing Cluster

> [!IMPORTANT]
> **Challenge Constraint:** Hackathon guidelines exclude provisioning a new cluster from scratch without authorization. Do not create an unapproved cluster. Connect to an approved existing cluster or request credentials from the organizers.

### Option A: Place Kubeconfig in Standard Windows Location
```powershell
# Create .kube directory in your Windows profile if needed
New-Item -ItemType Directory -Force -Path "$HOME\.kube" | Out-Null

# Copy your approved cluster's config file
Copy-Item -Path "C:\path\to\approved-cluster.kubeconfig" -Destination "$HOME\.kube\config" -Force

# Verify active context
kubectl config current-context
kubectl cluster-info
kubectl get nodes
```

### Option B: Set `KUBECONFIG_PATH` in Environment or `backend/.env`
In `backend/.env`:
```ini
KUBECONFIG_PATH=C:\path\to\approved-cluster.kubeconfig
KUBECONFIG_CONTEXT=my-approved-context
TARGET_NAMESPACE=kubepulse
TARGET_DEPLOYMENT=kubepulse-sample
```

Or for your current PowerShell terminal:
```powershell
$env:KUBECONFIG_PATH = "C:\path\to\approved-cluster.kubeconfig"
$env:KUBECONFIG_CONTEXT = "my-approved-context"
```

---

## 6. Local Cluster Option (Only If Explicitly Permitted)

If local cluster creation is permitted by the hackathon organizers:

### Using Minikube
```powershell
# Start Minikube with Docker driver
minikube start --driver=docker

# Enable Metrics Server for real CPU/Memory telemetry
minikube addons enable metrics-server

# Verify context is set
kubectl config current-context
kubectl cluster-info
```

### Using Kind
```powershell
kind create cluster --name kubepulse
kubectl config current-context
```

---

## 7. Quick Start (Windows PowerShell)

### Step 1: Start Backend API Gateway
```powershell
# In terminal 1:
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt

# Run automated backend unit test suite (28 tests)
pytest tests -v

# Start FastAPI server daemon
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload
```
*Backend runs at `http://127.0.0.1:8080` (Interactive Swagger docs at `http://127.0.0.1:8080/docs`).*

### Step 2: Start Frontend Dashboard
```powershell
# In terminal 2:
cd frontend
npm install
npm run dev
```
*Open your browser at `http://127.0.0.1:5173/`.*

---

## 8. Deployment & Operational Verification Workflow

When an approved cluster is connected, execute the 4 hackathon tests:

### 1. Build and Load Container Image
```powershell
./scripts/build-image.ps1
```
*Builds `kubepulse-sample:latest` with non-root security context (`UID 10001`) and loads it into the cluster.*

### 2. Apply Manifests (Test A — Initial Deployment)
```powershell
./scripts/deploy.ps1
```
*Applies manifests from `./k8s` and confirms 1 replica is ready:*
```powershell
kubectl get deployment kubepulse-sample -n kubepulse
kubectl get pods -n kubepulse -l app=kubepulse-demo
```

### 3. Scale to 3 Replicas (Test B — Horizontal Scaling)
```powershell
./scripts/scale.ps1 -Replicas 3
# Or use the interactive scale slider on the Workloads page in the UI
```
*Scales the workload and verifies rollout completion:*
```powershell
kubectl rollout status deployment/kubepulse-sample -n kubepulse
kubectl get pods -n kubepulse -l app=kubepulse-demo
```

### 4. Delete Pod for Self-Healing (Test C — Automatic Recovery)
```powershell
# Pick an active pod
$pod = (kubectl get pods -n kubepulse -l app=kubepulse-demo -o jsonpath='{.items[0].metadata.name}')

# Delete the pod (or click "Delete for Recovery Test" on the Pods page)
kubectl delete pod $pod -n kubepulse

# Observe the ReplicaSet controller event
kubectl get events -n kubepulse --field-selector reason=SuccessfulCreate
kubectl get pods -n kubepulse -l app=kubepulse-demo -w
```

### 5. Access Application Endpoint (Test D — Health Checks & Probes)
```powershell
# Forward service port locally
kubectl port-forward svc/kubepulse-sample-service 8000:80 -n kubepulse

# Query health probe and Downward API metadata
curl http://localhost:8000/health
```

### 6. Run Complete Automated Verification Suite
```powershell
./scripts/verify.ps1
```
*If a cluster is connected, executes all four tests sequentially. If no cluster or kubectl is present, executes the 28-test backend test suite for offline validation and clearly marks live cluster verification as pending.*

---

## 9. Automated Pytest Test Suite (28 Tests)

To execute the automated backend unit test suite:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest tests -v
```

**Test Coverage (28 Test Cases):**
1. `test_root_endpoint`: Operational status and API routes.
2. `test_health_endpoint`: Backend health check.
3. `test_cluster_disconnected_state`: Truthful disconnected status when no cluster is reachable.
4. `test_disconnected_operations_raise_503`: Confirms endpoints return 503 Service Unavailable when offline.
5. `test_k8s_api_errors_raise_502`: Confirms Kubernetes API errors are translated to 502 Bad Gateway.
6. `test_empty_namespaces`: Handling of empty namespace lists.
7. `test_actual_deployment_replica_counts`: Accurate reflection of desired and ready replicas.
8. `test_pod_readiness_and_restart_counts`: Accurate parsing of container conditions and restarts.
9. `test_scale_deployment_success`: Successful horizontal scale patch.
10. `test_scale_deployment_invalid_bounds`: Rejection of out-of-bounds replicas (<0 or >10).
11. `test_scale_deployment_api_failure`: Proper error handling when scale patch fails.
12. `test_pod_deletion_guardrails_foreign_workload`: Rejection of deletion requests for foreign/system pods.
13. `test_pod_deletion_non_existent`: Rejection of non-existent pods.
14. `test_pod_deletion_success`: Successful deletion of managed workload pod.
15. `test_replacement_observation_recovered`: Polling observation confirms recovery when desired replicas are ready.
16. `test_missing_metrics_api`: Truthful reporting when Metrics Server is not installed.
17. `test_metrics_api_success`: Accurate parsing of real pod CPU/memory measurements.
18. `test_demo_runner_reports_truthful_failure_when_disconnected`: Demo runner fails truthfully when cluster is offline.
19. `test_missing_kubeconfig_explicit_path`: Proper diagnostic when configured kubeconfig path does not exist.
20. `test_empty_kubeconfig_file`: Detection and diagnostic for 0-byte kubeconfig file.
21. `test_corrupted_yaml_kubeconfig`: Graceful error handling for invalid YAML.
22. `test_context_selection_not_found`: Rejection of non-existent context requested via `KUBECONFIG_CONTEXT`.
23. `test_no_current_context_in_kubeconfig`: Diagnostic when kubeconfig lacks a `current-context`.
24. `test_successful_connection_with_context`: Full connection verification with version, cluster, and context.
25. `test_unreachable_api_server_connection_refused`: Accurate diagnostic when API server is offline.
26. `test_authentication_failure_401`: Accurate error reporting for expired credentials (HTTP 401).
27. `test_authorization_failure_403`: Accurate error reporting for insufficient permissions (HTTP 403).
28. `test_error_sanitization_masks_secrets`: Verification that tokens, passwords, and keys are scrubbed.

---

## 10. Cleaning Up Resources

To remove the deployed Kubernetes resources from your cluster:
```powershell
./scripts/cleanup.ps1
```
Or manually:
```powershell
kubectl delete namespace kubepulse
```

---

## 11. Security & Least Privilege

- **Non-Root Containers**: Both `sample-app/Dockerfile` and `backend/Dockerfile` run under dedicated unprivileged users (`UID 10001` and `UID 10002`).
- **Namespace-Scoped RBAC**: ServiceAccount is bound to a `Role` (not `ClusterRole`), strictly limited to `kubepulse` namespace resources.
- **Destructive Action Guardrails**: The API rejects deletion of protected pods or workloads outside the managed deployment.
- **Zero Credential Exposure**: Kubeconfigs, service account tokens, and cluster certificates are processed exclusively on the backend and never exposed to the frontend browser.
