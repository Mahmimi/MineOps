# Restore

MineOps restore is a manual administrator procedure. Discord commands remain read-only and cannot trigger restore.

## Restore Targets

Restore the latest backup:

```powershell
.\scripts\restore.ps1 latest
```

Restore a specific backup:

```powershell
.\scripts\restore.ps1 backup_2026-06-27_1-30-36
```

## Validate A Backup

```powershell
.\scripts\validate-backup.ps1 latest
.\scripts\validate-backup.ps1 backup_2026-06-27_1-30-36
```

`latest` resolves to the newest backup folder by modification time, using the same ordering shown by `mineops backups`.

Validation checks:

- backup folder exists
- `world/` exists
- world size is greater than zero
- `world/level.dat` exists
- a region directory exists
- player data storage is reported when present

## Restore Procedure

`restore.ps1` performs this sequence:

1. Verify the Minecraft pod exists.
2. Verify the requested backup exists.
3. Validate backup contents.
4. Scale the Minecraft Deployment to `0`.
5. Wait for pod termination.
6. Create a temporary restore helper pod.
7. Restore world/config data into the Minecraft PVC.
8. Validate restored files.
9. Scale the Minecraft Deployment to `1`.
10. Wait until Minecraft is ready.
11. Verify the restored world exists.
12. Print a human-readable restore report.

## Safety Rules

- Backups are never overwritten.
- Backups are never deleted by restore.
- Restore is manual and runs outside Discord.
- If restore fails, the script attempts to scale Minecraft back to `1`.
- A temporary restore helper pod is deleted at the end.

## Backup Location

The restore helper reads backups from `/backups` inside Kubernetes.

For k3d, this is mapped from the host path:

```powershell
$env:MINEOPS_BACKUP_HOST_PATH = (Resolve-Path .\backups).Path
```

The cluster must be created with this environment variable set.
