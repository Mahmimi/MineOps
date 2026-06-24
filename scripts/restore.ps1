param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Backup,

  [string]$Namespace = "mineops",
  [string]$Deployment = "minecraft",
  [string]$PvcName = "minecraft-data",
  [string]$BackupRoot = "",
  [string]$HelperImage = "bitnami/kubectl:latest"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($BackupRoot)) {
  $BackupRoot = Join-Path $RepoRoot "backups"
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message"
}

function Require-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "$Name was not found in PATH."
  }
}

function Resolve-BackupName {
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
      return "latest"
    }

    $latestTimestamp = Get-ChildItem -LiteralPath $Root -Directory |
      Where-Object { $_.Name -match '^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$' } |
      Sort-Object Name -Descending |
      Select-Object -First 1

    if ($null -eq $latestTimestamp) {
      throw "No timestamped backups found under: $Root"
    }

    return $latestTimestamp.Name
  }

  $path = Join-Path $Root $Name
  if (-not (Test-Path -LiteralPath $path -PathType Container)) {
    throw "Requested backup does not exist: $path"
  }

  return $Name
}

function Wait-ForMinecraftPodsDeleted {
  param(
    [string]$Ns,
    [string]$Selector
  )

  for ($attempt = 1; $attempt -le 60; $attempt++) {
    $pods = kubectl get pods -n $Ns -l $Selector -o jsonpath="{.items[*].metadata.name}"
    if ([string]::IsNullOrWhiteSpace($pods)) {
      return
    }
    Start-Sleep -Seconds 2
  }

  throw "Timed out waiting for Minecraft pod termination."
}

function Apply-RestoreHelper {
  param(
    [string]$Ns,
    [string]$ClaimName,
    [string]$Image
  )

  $manifest = @"
apiVersion: v1
kind: Pod
metadata:
  name: mineops-restore-helper
  namespace: $Ns
  labels:
    app.kubernetes.io/name: mineops-restore-helper
    app.kubernetes.io/part-of: mineops
spec:
  restartPolicy: Never
  containers:
    - name: restore
      image: $Image
      command: ["/bin/sh", "-c", "sleep 3600"]
      securityContext:
        allowPrivilegeEscalation: false
        runAsNonRoot: true
        runAsUser: 1000
        runAsGroup: 1000
        capabilities:
          drop:
            - ALL
      volumeMounts:
        - name: minecraft-data
          mountPath: /minecraft-data
        - name: backups
          mountPath: /backups
          readOnly: true
  volumes:
    - name: minecraft-data
      persistentVolumeClaim:
        claimName: $ClaimName
    - name: backups
      hostPath:
        path: /backups
        type: Directory
"@

  $path = Join-Path $env:TEMP "mineops-restore-helper.yaml"
  Set-Content -LiteralPath $path -Value $manifest -Encoding utf8
  kubectl apply -f $path
}

Require-Command -Name "kubectl"

$selector = "app.kubernetes.io/name=minecraft"
$backupName = Resolve-BackupName -Root $BackupRoot -Name $Backup
$backupPath = Join-Path $BackupRoot $backupName
$startedAt = Get-Date
$helperCreated = $false

Write-Host "MineOps Restore"
Write-Host "Backup: $backupName"
Write-Host "Namespace: $Namespace"

Write-Step "Verify Minecraft pod exists"
$existingPod = kubectl get pods -n $Namespace -l $selector -o jsonpath="{.items[0].metadata.name}"
if ([string]::IsNullOrWhiteSpace($existingPod)) {
  throw "Minecraft pod was not found."
}
Write-Host "Found Minecraft pod: $existingPod"

Write-Step "Validate requested backup"
& (Join-Path $PSScriptRoot "validate-backup.ps1") $backupName -BackupRoot $BackupRoot

try {
  Write-Step "Scale Minecraft down"
  kubectl scale deployment/$Deployment -n $Namespace --replicas=0

  Write-Step "Wait for pod termination"
  Wait-ForMinecraftPodsDeleted -Ns $Namespace -Selector $selector

  Write-Step "Create restore helper pod"
  kubectl delete pod mineops-restore-helper -n $Namespace --ignore-not-found=true | Out-Null
  Apply-RestoreHelper -Ns $Namespace -ClaimName $PvcName -Image $HelperImage
  $helperCreated = $true
  kubectl wait -n $Namespace --for=condition=Ready pod/mineops-restore-helper --timeout=120s

  Write-Step "Restore world data"
  $restoreCommand = @"
set -eu
backup="/backups/$backupName"
target="/minecraft-data"
incoming="/minecraft-data/.restore-incoming"

test -d "`$backup/world"
test -f "`$backup/world/level.dat"
rm -rf "`$incoming"
mkdir -p "`$incoming"
tar -C "`$backup" -cf - . | tar -C "`$incoming" --no-same-owner -xf -
test -d "`$incoming/world"
test -f "`$incoming/world/level.dat"
for item in world world_nether world_the_end server.properties whitelist.json ops.json banned-ips.json banned-players.json usercache.json; do
  rm -rf "`$target/`$item"
done
for item in "`$incoming"/*; do
  mv "`$item" "`$target/"
done
rm -rf "`$incoming"
test -d "`$target/world"
test -f "`$target/world/level.dat"
"@

  kubectl exec -n $Namespace mineops-restore-helper -- /bin/sh -lc $restoreCommand

  Write-Step "Start Minecraft"
  kubectl scale deployment/$Deployment -n $Namespace --replicas=1
  kubectl rollout status deployment/$Deployment -n $Namespace --timeout=300s

  Write-Step "Verify restored world"
  $newPod = kubectl get pods -n $Namespace -l $selector -o jsonpath="{.items[0].metadata.name}"
  kubectl exec -n $Namespace $newPod -- sh -lc "test -d /data/world && test -f /data/world/level.dat"

  $finishedAt = Get-Date
  $duration = New-TimeSpan -Start $startedAt -End $finishedAt

  Write-Host ""
  Write-Host "Restore Report"
  Write-Host "Status: PASS"
  Write-Host "Backup: $backupName"
  Write-Host "Started: $startedAt"
  Write-Host "Finished: $finishedAt"
  Write-Host ("Duration: {0}m {1}s" -f [math]::Floor($duration.TotalMinutes), $duration.Seconds)
  Write-Host "Minecraft Ready: yes"
} catch {
  Write-Host ""
  Write-Host "Restore Report"
  Write-Host "Status: FAIL"
  Write-Host "Backup: $backupName"
  Write-Host "Error: $($_.Exception.Message)"
  Write-Host ""
  Write-Host "Attempting to start Minecraft for safe recovery."
  kubectl scale deployment/$Deployment -n $Namespace --replicas=1 | Out-Null
  throw
} finally {
  if ($helperCreated) {
    kubectl delete pod mineops-restore-helper -n $Namespace --ignore-not-found=true | Out-Null
  }
}
