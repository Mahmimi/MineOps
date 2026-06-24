param(
  [Parameter(Position = 0)]
  [string]$Backup = "latest",

  [string]$BackupRoot = ""
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $RepoRoot "backups"
}

function Format-Bytes {
  param([long]$Bytes)

  if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
  if ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
  return "$Bytes B"
}

function Resolve-BackupPath {
  param(
    [string]$Root,
    [string]$Name
  )

  if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
    throw "Backup root does not exist: $Root"
  }

  if ($Name -eq "latest") {
    $latestPath = Join-Path $Root "latest"
    if (Test-Path -LiteralPath $latestPath -PathType Container) {
      return (Resolve-Path -LiteralPath $latestPath).Path
    }

    $latestTimestamp = Get-ChildItem -LiteralPath $Root -Directory |
      Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$' } |
      Sort-Object Name -Descending |
      Select-Object -First 1

    if ($null -eq $latestTimestamp) {
      throw "No timestamped backups found under: $Root"
    }

    return $latestTimestamp.FullName
  }

  $path = Join-Path $Root $Name
  if (-not (Test-Path -LiteralPath $path -PathType Container)) {
    throw "Requested backup does not exist: $path"
  }

  return (Resolve-Path -LiteralPath $path).Path
}

function Test-Backup {
  param([string]$Path)

  $worldPath = Join-Path $Path "world"
  $levelDat = Join-Path $worldPath "level.dat"
  $regionPath = Join-Path $worldPath "region"
  $dimensionRegionPath = Join-Path $worldPath "dimensions\minecraft\overworld\region"
  $playerDataPath = Join-Path $worldPath "playerdata"
  $playersPath = Join-Path $worldPath "players"

  $worldExists = Test-Path -LiteralPath $worldPath -PathType Container
  $levelExists = Test-Path -LiteralPath $levelDat -PathType Leaf
  $regionExists = (Test-Path -LiteralPath $regionPath -PathType Container) -or (Test-Path -LiteralPath $dimensionRegionPath -PathType Container)
  $playerStoreExists = (Test-Path -LiteralPath $playerDataPath -PathType Container) -or (Test-Path -LiteralPath $playersPath -PathType Container)

  $size = 0L
  if ($worldExists) {
    $size = (Get-ChildItem -LiteralPath $worldPath -Recurse -File -Force -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
    if ($null -eq $size) { $size = 0L }
  }

  return [pscustomobject]@{
    BackupPath = $Path
    BackupName = Split-Path -Leaf $Path
    WorldExists = $worldExists
    WorldSizeBytes = [long]$size
    LevelDatExists = $levelExists
    RegionExists = $regionExists
    PlayerStoreExists = $playerStoreExists
    RequiredFilesPass = $worldExists -and $levelExists -and $regionExists
    IntegrityPass = $worldExists -and $levelExists -and $regionExists -and ($size -gt 0)
  }
}

$resolvedBackup = Resolve-BackupPath -Root $BackupRoot -Name $Backup
$result = Test-Backup -Path $resolvedBackup
$status = if ($result.IntegrityPass) { "PASS" } else { "FAIL" }
$requiredStatus = if ($result.RequiredFilesPass) { "PASS" } else { "FAIL" }
$integrityStatus = if ($result.IntegrityPass) { "PASS" } else { "FAIL" }
$playerStoreStatus = if ($result.PlayerStoreExists) { "PASS" } else { "OPTIONAL/MISSING" }

Write-Host "Backup Validation"
Write-Host ""
Write-Host "Backup:"
Write-Host $result.BackupName
Write-Host ""
Write-Host "Status:"
Write-Host $status
Write-Host ""
Write-Host "World Size:"
Write-Host (Format-Bytes -Bytes $result.WorldSizeBytes)
Write-Host ""
Write-Host "Required Files:"
Write-Host $requiredStatus
Write-Host " - world/: $($result.WorldExists)"
Write-Host " - level.dat: $($result.LevelDatExists)"
Write-Host " - region/: $($result.RegionExists)"
Write-Host " - playerdata/ or players/: $playerStoreStatus"
Write-Host ""
Write-Host "Integrity:"
Write-Host $integrityStatus

if (-not $result.IntegrityPass) {
  exit 1
}
