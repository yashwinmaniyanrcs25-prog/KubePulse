import React, { useState } from 'react';
import { Terminal, Copy, Check, AlertTriangle, Info, CheckCircle2, Server, HelpCircle, Layers } from 'lucide-react';

export const DeploymentGuidePage: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const codeBlocks = {
    checkEnvironment: `# ==========================================================
# 1. Check Tooling & Kubeconfig Status (Windows PowerShell)
# ==========================================================

Write-Host "--- Checking Kubernetes Client (kubectl) ---" -ForegroundColor Cyan
if (Get-Command kubectl -ErrorAction SilentlyContinue) {
    kubectl version --client --output=yaml
} else {
    Write-Warning "kubectl is NOT installed or not in PATH."
    Write-Host "Note: kubectl is a command-line client, not a cluster." -ForegroundColor Yellow
}

Write-Host "\`n--- Checking Docker Daemon ---" -ForegroundColor Cyan
if (Get-Command docker -ErrorAction SilentlyContinue) {
    docker --version
} else {
    Write-Warning "Docker is NOT installed or not in PATH."
}

Write-Host "\`n--- Checking Kubeconfig Configuration ---" -ForegroundColor Cyan
$defaultKubeconfig = "$HOME\\.kube\\config"
if (Test-Path $defaultKubeconfig) {
    Write-Host "Found standard kubeconfig at: $defaultKubeconfig" -ForegroundColor Green
    if (Get-Command kubectl -ErrorAction SilentlyContinue) {
        kubectl config get-contexts
        Write-Host "Active Context: $(kubectl config current-context)" -ForegroundColor Green
    }
} else {
    Write-Warning "No kubeconfig found at standard location: $defaultKubeconfig"
    Write-Host "Set \$env:KUBECONFIG_PATH to your approved cluster config, or place config at \$HOME\\.kube\\config." -ForegroundColor Yellow
}`,

    configureExistingCluster: `# ==========================================================
# 2. Configure Approved Cluster Kubeconfig
# ==========================================================

# Option A: Copy approved kubeconfig to standard Windows location
New-Item -ItemType Directory -Force -Path "$HOME\\.kube" | Out-Null
Copy-Item -Path "C:\\path\\to\\approved-cluster.kubeconfig" -Destination "$HOME\\.kube\\config" -Force

# Option B: Point KubePulse backend to a custom kubeconfig file
$env:KUBECONFIG_PATH = "C:\\path\\to\\approved-cluster.kubeconfig"

# (Optional) Specify an exact context if your kubeconfig contains multiple
$env:KUBECONFIG_CONTEXT = "my-approved-context"

# Verify connectivity with the approved control plane
kubectl config current-context
kubectl cluster-info
kubectl get nodes`,

    localClusterIfPermitted: `# ==========================================================
# 3. Local Cluster Creation (ONLY IF PERMITTED BY ORGANIZERS)
# ==========================================================
# Warning: The challenge guidelines exclude setting up a new cluster
# from scratch without authorization. Use an approved cluster if provided.

# If local cluster creation IS permitted on your machine:
# Minikube:
minikube start --driver=docker
minikube addons enable metrics-server

# Or Kind:
kind create cluster --name kubepulse

# Verify context is active:
kubectl config current-context`,

    startBackend: `# ==========================================================
# 4. Start KubePulse Backend Gateway
# ==========================================================
cd backend
python -m venv venv
.\\venv\\Scripts\\Activate.ps1
pip install -r requirements.txt

# Run backend automated test suite (28 tests)
pytest tests -v

# Start FastAPI Uvicorn Server (Port 8080)
python -m uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload`,

    startFrontend: `# ==========================================================
# 5. Start KubePulse Frontend Dashboard
# ==========================================================
cd frontend
npm install
npm run dev
# Dashboard opens at http://127.0.0.1:5173/`,

    buildDocker: `# ==========================================================
# 6. Build Sample Workload Container
# ==========================================================
docker build -t kubepulse-sample:latest ./sample-app

# If using Minikube, load image into cluster cache:
minikube image load kubepulse-sample:latest`,

    deployWorkload: `# ==========================================================
# 7. Apply Workload Manifests (Test A — Initial Deployment)
# ==========================================================
kubectl apply -k ./k8s
kubectl rollout status deployment/kubepulse-sample -n kubepulse --timeout=90s
kubectl get deployment,pods,svc -n kubepulse -o wide`,

    scaleWorkload: `# ==========================================================
# 8. Scale to 3 Replicas (Test B — Horizontal Scaling)
# ==========================================================
# Can also be executed via Workloads page in the KubePulse UI
kubectl scale deployment kubepulse-sample --replicas=3 -n kubepulse
kubectl rollout status deployment/kubepulse-sample -n kubepulse --timeout=60s
kubectl get pods -n kubepulse -l app=kubepulse-demo -o wide`,

    selfHealing: `# ==========================================================
# 9. Pod Deletion & Recovery (Test C — Self-Healing)
# ==========================================================
# Pick an active pod
$pod = (kubectl get pods -n kubepulse -l app=kubepulse-demo -o jsonpath='{.items[0].metadata.name}')

# Delete the pod (or click "Delete for Recovery Test" on Pods page in UI)
kubectl delete pod $pod -n kubepulse

# Observe the ReplicaSet controller event
kubectl get events -n kubepulse --field-selector reason=SuccessfulCreate
kubectl get pods -n kubepulse -l app=kubepulse-demo -w`,

    portForward: `# ==========================================================
# 10. Service Endpoint & Probes (Test D — Health Checks)
# ==========================================================
kubectl port-forward svc/kubepulse-sample-service 8000:80 -n kubepulse
curl http://localhost:8000/health`
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
          <Terminal className="w-5 h-5 text-cyan-400" />
          <span>Windows PowerShell Setup & Deployment Guide</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Beginner-friendly PowerShell instructions for checking prerequisites, configuring cluster credentials, and running the verified KubePulse dashboard.
        </p>
      </div>

      {/* Challenge Rule & Constraint Alert */}
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-950/20 text-amber-200 space-y-2">
        <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Important Hackathon Challenge Constraint</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          The challenge instructions exclude setting up a new cluster from scratch. Do not automatically install or spin up an unauthorized cluster.
          Connect to an approved cluster or place valid kubeconfig credentials at <code className="text-cyan-300 font-mono text-[11px]">%USERPROFILE%\.kube\config</code>.
          Until an authorized cluster is connected, KubePulse maintains a truthful offline state with zero fabricated telemetry.
        </p>
      </div>

      {/* Concept Clarification Box */}
      <div className="glass-card p-5 border-cyan-500/30">
        <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <span>Understanding `kubectl` vs a Kubernetes Cluster</span>
        </h2>
        <div className="text-xs text-slate-300 space-y-2 leading-relaxed">
          <p>
            <strong className="text-white">kubectl</strong> is a command-line client used to communicate with an API server. Installing <code className="text-cyan-300 font-mono">kubectl</code> does not create or start a cluster.
          </p>
          <p>
            A <strong className="text-white">Kubernetes Cluster</strong> is the actual running control plane and worker nodes (e.g., hosted on cloud or running locally via Minikube/Kind). KubePulse requires an active cluster API server endpoint to retrieve live data.
          </p>
        </div>
      </div>

      {/* Guide Steps */}
      <div className="space-y-4">
        {/* Step 1: Check Environment */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-xs">1</span>
              <span>Check Tooling & Kubeconfig Status</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.checkEnvironment, 'env')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'env' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'env' ? 'Copied' : 'Copy PowerShell'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Run this script in PowerShell to verify whether kubectl, Docker, and standard kubeconfig files exist on your machine.
          </p>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-cyan-300 select-all overflow-x-auto">
            {codeBlocks.checkEnvironment}
          </pre>
        </div>

        {/* Step 2: Configure Approved Cluster */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs">2</span>
              <span>Configure Approved Cluster Kubeconfig</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.configureExistingCluster, 'config')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'config' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'config' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Copy your approved cluster config to the default path or set the <code className="text-cyan-300 font-mono">KUBECONFIG_PATH</code> environment variable.
          </p>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-emerald-300 select-all overflow-x-auto">
            {codeBlocks.configureExistingCluster}
          </pre>
        </div>

        {/* Step 3: Local Cluster (if permitted) */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center font-mono text-xs">3</span>
              <span>Local Cluster Option (Only If Permitted)</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.localClusterIfPermitted, 'local')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'local' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'local' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            If local cluster creation is permitted by the organizers, start Minikube or Kind:
          </p>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-purple-300 select-all overflow-x-auto">
            {codeBlocks.localClusterIfPermitted}
          </pre>
        </div>

        {/* Step 4: Start Backend */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs">4</span>
              <span>Start Backend API Gateway</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.startBackend, 'backend')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'backend' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'backend' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-emerald-300 select-all overflow-x-auto">
            {codeBlocks.startBackend}
          </pre>
        </div>

        {/* Step 5: Start Frontend */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-xs">5</span>
              <span>Start Frontend Dashboard</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.startFrontend, 'frontend')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'frontend' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'frontend' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-cyan-300 select-all overflow-x-auto">
            {codeBlocks.startFrontend}
          </pre>
        </div>

        {/* Step 6: Deploy Manifests */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono text-xs">6</span>
              <span>Apply Workload Manifests (Test A)</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.deployWorkload, 'deploy')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'deploy' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'deploy' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-emerald-300 select-all overflow-x-auto">
            {codeBlocks.deployWorkload}
          </pre>
        </div>

        {/* Step 7: Scale to 3 Replicas */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-mono text-xs">7</span>
              <span>Scale from 1 to 3 Replicas (Test B)</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.scaleWorkload, 'scale')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'scale' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'scale' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-cyan-300 select-all overflow-x-auto">
            {codeBlocks.scaleWorkload}
          </pre>
        </div>

        {/* Step 8: Self-Healing Recovery */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-red-500/20 text-red-400 flex items-center justify-center font-mono text-xs">8</span>
              <span>Demonstrate Self-Healing Recovery (Test C)</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.selfHealing, 'healing')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'healing' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'healing' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-slate-200 select-all overflow-x-auto">
            {codeBlocks.selfHealing}
          </pre>
        </div>

        {/* Step 9: Application Endpoint */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="h-6 w-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-mono text-xs">9</span>
              <span>Access Application Endpoint & Probes (Test D)</span>
            </h2>
            <button
              onClick={() => handleCopy(codeBlocks.portForward, 'endpoint')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono"
            >
              {copiedSection === 'endpoint' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'endpoint' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className="bg-navy-950 p-3.5 rounded-xl border border-navy-800 font-mono text-xs text-amber-300 select-all overflow-x-auto">
            {codeBlocks.portForward}
          </pre>
        </div>
      </div>
    </div>
  );
};
