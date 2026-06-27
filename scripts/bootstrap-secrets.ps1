param(
  [Parameter(Mandatory = $true)]
  [string]$RuntimeConfigPath,

  [string]$Namespace = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
  throw "kubectl was not found in PATH."
}

if (-not (Test-Path -LiteralPath $RuntimeConfigPath)) {
  throw "Runtime config artifact not found: $RuntimeConfigPath"
}

$artifact = Get-Content -LiteralPath $RuntimeConfigPath -Raw | ConvertFrom-Json
$targetNamespace = if (-not [string]::IsNullOrWhiteSpace($Namespace)) {
  $Namespace
} elseif (-not [string]::IsNullOrWhiteSpace($artifact.namespace)) {
  $artifact.namespace
} else {
  "mineops"
}

function Get-LiteralArgs {
  param([object]$Data)

  $literalArgs = @()
  if ($null -eq $Data) {
    return $literalArgs
  }

  foreach ($property in $Data.PSObject.Properties) {
    $literalArgs += "--from-literal=$($property.Name)=$($property.Value)"
  }

  return $literalArgs
}

function Apply-Labels {
  param(
    [string]$ResourceKind,
    [string]$ResourceName,
    [object]$Labels
  )

  if ($null -eq $Labels) {
    return
  }

  $labelArgs = @()
  foreach ($property in $Labels.PSObject.Properties) {
    if (-not [string]::IsNullOrWhiteSpace($property.Name)) {
      $labelArgs += "$($property.Name)=$($property.Value)"
    }
  }

  if ($labelArgs.Count -eq 0) {
    return
  }

  kubectl label $ResourceKind $ResourceName -n $targetNamespace @labelArgs --overwrite | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to label $ResourceKind artifact: $ResourceName"
  }
}
Write-Host "Bootstrapping MineOps runtime artifacts in namespace '$targetNamespace'."
Write-Host "Secret values are not printed."

foreach ($secret in @($artifact.secrets)) {
  if ([string]::IsNullOrWhiteSpace($secret.name)) {
    throw "Runtime secret artifact is missing a name."
  }

  $renderArgs = @("create", "secret", "generic", $secret.name, "-n", $targetNamespace) + (Get-LiteralArgs -Data $secret.data) + @("--dry-run=client", "-o", "yaml")

  $manifest = kubectl @renderArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to render Secret artifact: $($secret.name)"
  }
  $manifest | kubectl apply -f - | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply Secret artifact: $($secret.name)"
  }
  Apply-Labels -ResourceKind "secret" -ResourceName $secret.name -Labels $secret.labels
}

foreach ($configMap in @($artifact.configMaps)) {
  if ([string]::IsNullOrWhiteSpace($configMap.name)) {
    throw "Runtime ConfigMap artifact is missing a name."
  }

  $renderArgs = @("create", "configmap", $configMap.name, "-n", $targetNamespace) + (Get-LiteralArgs -Data $configMap.data) + @("--dry-run=client", "-o", "yaml")

  $manifest = kubectl @renderArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to render ConfigMap artifact: $($configMap.name)"
  }
  $manifest | kubectl apply -f - | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to apply ConfigMap artifact: $($configMap.name)"
  }
  Apply-Labels -ResourceKind "configmap" -ResourceName $configMap.name -Labels $configMap.labels

  if ($configMap.name -eq "mineops-admins") {
    Write-Host "MineOps admin allow-list ConfigMap is ready."
  }
}

if (-not (@($artifact.configMaps) | Where-Object { $_.name -eq "mineops-admins" })) {
  Write-Host "MineOps admin allow-list not included in runtime artifact. Copy mineops-admins.json.example to mineops-admins.json to enable admin-only Discord lifecycle commands."
}

Write-Host "MineOps runtime artifacts are ready."