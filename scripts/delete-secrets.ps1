param(
  [string]$Namespace = "mineops"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
  throw "kubectl was not found in PATH."
}

Write-Host "Deleting MineOps runtime Secrets from namespace '$Namespace'."
kubectl delete secret discord-bot-secret playit-secret -n $Namespace --ignore-not-found=true
Write-Host "MineOps runtime Secret cleanup completed."
