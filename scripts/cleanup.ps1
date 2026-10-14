<#
.SYNOPSIS
    Cleans up all KubePulse Kubernetes resources.
.DESCRIPTION
    Deletes the kubepulse namespace and associated workloads.
#>
[CmdletBinding()]
param(
    [string]$Namespace = "kubepulse"
)

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

Write-Host "Cleaning up KubePulse resources in namespace '$Namespace'..." -ForegroundColor Yellow
$kubectlCmd = Get-Command kubectl -ErrorAction SilentlyContinue
if ($kubectlCmd) {
    kubectl delete namespace $Namespace --ignore-not-found=true
    Write-Host "Cleanup completed." -ForegroundColor Green
} else {
    Write-Host "kubectl not available. Nothing to delete." -ForegroundColor Yellow
}
