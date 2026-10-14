<#
.SYNOPSIS
    Builds the KubePulse sample workload Docker image and loads it into local clusters.
.DESCRIPTION
    Builds kubepulse-sample:latest from ./sample-app and automatically loads into Minikube or kind if available.
#>
[CmdletBinding()]
param(
    [string]$ImageTag = "kubepulse-sample:latest",
    [string]$ContextDir = "./sample-app"
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
Write-Host "  KubePulse -- Build Sample Container Image" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Docker CLI
$dockerCmd = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerCmd) {
    Write-Warning "Docker is not found in PATH. Please ensure Docker Desktop is installed and running."
    exit 1
}

Write-Host "[1/4] Building Docker image '$ImageTag' from '$ContextDir'..." -ForegroundColor Green
docker build -t $ImageTag $ContextDir
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to build Docker image '$ImageTag'."
}
Write-Host "  [OK] Docker image successfully built: $ImageTag" -ForegroundColor Green

# 2. Check Minikube
$minikubeCmd = Get-Command minikube -ErrorAction SilentlyContinue
if ($minikubeCmd) {
    Write-Host "[2/4] Minikube detected. Checking status..." -ForegroundColor Cyan
    $status = minikube status 2>&1
    if ($status -match "Running") {
        Write-Host "  -> Loading '$ImageTag' into Minikube cluster cache..." -ForegroundColor Yellow
        minikube image load $ImageTag
        Write-Host "  [OK] Image loaded into Minikube." -ForegroundColor Green
    }
}

# 3. Check Kind
$kindCmd = Get-Command kind -ErrorAction SilentlyContinue
if ($kindCmd) {
    Write-Host "[3/4] Kind detected. Checking kind clusters..." -ForegroundColor Cyan
    $clusters = kind get clusters 2>&1
    if ($clusters -and $LASTEXITCODE -eq 0) {
        $clusterName = ($clusters -split "`n")[0].Trim()
        Write-Host "  -> Loading '$ImageTag' into kind cluster '$clusterName'..." -ForegroundColor Yellow
        kind load docker-image $ImageTag --name $clusterName
        Write-Host "  [OK] Image loaded into kind." -ForegroundColor Green
    }
}

# 4. Check Docker Desktop Kubernetes
$kubectlCmd = Get-Command kubectl -ErrorAction SilentlyContinue
if ($kubectlCmd) {
    $currentCtx = kubectl config current-context 2>&1
    if ($currentCtx -eq "docker-desktop") {
        Write-Host "[4/4] Docker Desktop Kubernetes detected. Image '$ImageTag' is locally available to cluster." -ForegroundColor Green
    }
}

Write-Host "`nAll image preparation completed successfully!" -ForegroundColor Green
