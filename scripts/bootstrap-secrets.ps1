param(
  [string]$EnvPath = (Join-Path (Split-Path -Parent $PSScriptRoot) ".env"),
  [string]$Namespace = "mineops"
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

function Require-EnvValue {
  param(
    [hashtable]$Values,
    [string]$Name
  )

  if (-not $Values.ContainsKey($Name) -or [string]::IsNullOrWhiteSpace($Values[$Name])) {
    throw "Missing required value in .env: $Name"
  }

  return $Values[$Name]
}

if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
  throw "kubectl was not found in PATH."
}

$envValues = Read-DotEnv -Path $EnvPath

$discordToken = Require-EnvValue -Values $envValues -Name "DISCORD_TOKEN"
$discordClientId = Require-EnvValue -Values $envValues -Name "DISCORD_CLIENT_ID"
$discordGuildId = Require-EnvValue -Values $envValues -Name "DISCORD_GUILD_ID"
$discordAlertChannelId = if ($envValues.ContainsKey("DISCORD_ALERT_CHANNEL_ID")) { $envValues["DISCORD_ALERT_CHANNEL_ID"] } else { "" }
$playitSecretKey = Require-EnvValue -Values $envValues -Name "PLAYIT_SECRET_KEY"
$playitJoinAddress = if ($envValues.ContainsKey("PLAYIT_JOIN_ADDRESS")) { $envValues["PLAYIT_JOIN_ADDRESS"] } else { "" }
$idleShutdownEnabled = if ($envValues.ContainsKey("IDLE_SHUTDOWN_ENABLED") -and -not [string]::IsNullOrWhiteSpace($envValues["IDLE_SHUTDOWN_ENABLED"])) { $envValues["IDLE_SHUTDOWN_ENABLED"] } else { "true" }
$idleShutdownMinutes = if ($envValues.ContainsKey("IDLE_SHUTDOWN_MINUTES") -and -not [string]::IsNullOrWhiteSpace($envValues["IDLE_SHUTDOWN_MINUTES"])) { $envValues["IDLE_SHUTDOWN_MINUTES"] } else { "30" }
$repoRoot = Split-Path -Parent $PSScriptRoot
$adminConfigPath = Join-Path $repoRoot "mineops-admins.json"

Write-Host "Bootstrapping MineOps runtime Secrets in namespace '$Namespace'."
Write-Host "Secret values are not printed."

kubectl create secret generic discord-bot-secret `
  -n $Namespace `
  --from-literal=token="$discordToken" `
  --from-literal=client-id="$discordClientId" `
  --from-literal=guild-id="$discordGuildId" `
  --from-literal=alert-channel-id="$discordAlertChannelId" `
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create secret generic playit-secret `
  -n $Namespace `
  --from-literal=secret-key="$playitSecretKey" `
  --dry-run=client -o yaml | kubectl apply -f -

kubectl create configmap mineops-runtime-config `
  -n $Namespace `
  --from-literal=PLAYIT_JOIN_ADDRESS="$playitJoinAddress" `
  --from-literal=IDLE_SHUTDOWN_ENABLED="$idleShutdownEnabled" `
  --from-literal=IDLE_SHUTDOWN_MINUTES="$idleShutdownMinutes" `
  --dry-run=client -o yaml | kubectl apply -f -

if (Test-Path -LiteralPath $adminConfigPath) {
  kubectl create configmap mineops-admins `
    -n $Namespace `
    --from-file=mineops-admins.json="$adminConfigPath" `
    --dry-run=client -o yaml | kubectl apply -f -
  Write-Host "MineOps admin allow-list ConfigMap is ready."
} else {
  Write-Host "MineOps admin allow-list not found. Copy mineops-admins.json.example to mineops-admins.json to enable admin-only Discord lifecycle commands."
}

Write-Host "MineOps runtime Secrets are ready."
