param(
  [string]$EnvPath = (Join-Path (Split-Path -Parent $PSScriptRoot) ".env")
)

$ErrorActionPreference = "Stop"

function Read-DotEnv {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Environment file not found: $Path"
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
      continue
    }

    $separator = $trimmed.IndexOf("=")
    if ($separator -lt 1) {
      continue
    }

    $key = $trimmed.Substring(0, $separator).Trim()
    $value = $trimmed.Substring($separator + 1).Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

$required = @(
  "DISCORD_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_GUILD_ID",
  "PLAYIT_SECRET_KEY"
)

Write-Host "Validating MineOps local environment file: $EnvPath"

$envValues = Read-DotEnv -Path $EnvPath
$missing = @()

foreach ($name in $required) {
  if (-not $envValues.ContainsKey($name) -or [string]::IsNullOrWhiteSpace($envValues[$name])) {
    Write-Host "[MISSING] $name"
    $missing += $name
  } else {
    Write-Host "[OK]      $name"
  }
}

if ($missing.Count -gt 0) {
  Write-Error "Missing required MineOps environment values: $($missing -join ', ')"
  exit 1
}

Write-Host "MineOps environment validation passed."
