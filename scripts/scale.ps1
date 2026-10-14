<#
.SYNOPSIS
    Scales the KubePulse sample deployment to a target replica count.
.DESCRIPTION
    Updates deployment replicas (e.g. from 1 to 3) and waits for rollout confirmation.
#>
[CmdletBinding()]
param(
    [int]$Replicas = 3,
    [string]$DeploymentName = "kubepulse-sample",
    [string]$Namespace = "kubepulse"
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
Write-Host "  KubePulse -- Horizontal Replica Scaling" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$kubectlCmd = Get-Command kubectl -ErrorAction SilentlyContinue
if (-not $kubectlCmd) {
    Write-Warning "kubectl not found. Scaling can also be triggered via KubePulse Dashboard UI or REST API."
    exit 1
}

Write-Host "[1/2] Scaling deployment '$DeploymentName' in namespace '$Namespace' to $Replicas replica(s)..." -ForegroundColor Cyan
kubectl scale deployment $DeploymentName --replicas=$Replicas -n $Namespace

Write-Host "`n[2/2] Awaiting rollout completion (timeout 60s)..." -ForegroundColor Cyan
kubectl rollout status deployment/$DeploymentName -n $Namespace --timeout=60s

Write-Host "`nUpdated pods:" -ForegroundColor Green
kubectl get pods -n $Namespace -l app=kubepulse-demo -o wide

Write-Host "`n[OK] Scaled successfully to $Replicas ready replica(s)!" -ForegroundColor Green
