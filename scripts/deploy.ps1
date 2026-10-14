<#
.SYNOPSIS
    Deploys the KubePulse manifests to Kubernetes.
.DESCRIPTION
    Applies namespace, RBAC, deployment, and service manifests, then waits for initial readiness.
#>
[CmdletBinding()]
param(
    [string]$Namespace = "kubepulse",
    [string]$ManifestDir = "./k8s"
)

$ErrorActionPreference = "Stop"

# Ensure Docker and kubectl binaries from Docker Desktop are discoverable in PATH
$possibleBinDirs = @(
    "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin",
    "C:\Program Files\Docker\Docker\resources\bin",
    "$env:ProgramFiles\Docker\Docker\resources\bin"
)
foreach ($dir in $possibleBinDirs) {
    if ((Test-Path $dir) -and ($env:PATH -notlike "*$dir*")) {
        $env:PATH = "$dir;$env:PATH"
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  KubePulse -- Deploy Kubernetes Workload" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check kubectl
$kubectlCmd = Get-Command kubectl -ErrorAction SilentlyContinue
if (-not $kubectlCmd) {
    Write-Warning "kubectl is not found in PATH. Please verify your Kubernetes CLI setup."
    exit 1
}

# 2. Check cluster connection
Write-Host "[1/4] Checking cluster connectivity..." -ForegroundColor Cyan
kubectl cluster-info
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to reach Kubernetes cluster. Check your kubeconfig context."
}

# 3. Apply manifests via kustomize
Write-Host "`n[2/4] Applying manifests from '$ManifestDir'..." -ForegroundColor Cyan
kubectl apply -k $ManifestDir

# 4. Wait for rollout (bounded timeout)
Write-Host "`n[3/4] Awaiting rollout of 'kubepulse-sample' (timeout 90s)..." -ForegroundColor Cyan
kubectl rollout status deployment/kubepulse-sample -n $Namespace --timeout=90s

# 5. Display deployed status
Write-Host "`n[4/4] Current deployment and service state:" -ForegroundColor Green
kubectl get deployment,pods,svc -n $Namespace -o wide

Write-Host "`nDeployment completed successfully! Workload is live." -ForegroundColor Green
