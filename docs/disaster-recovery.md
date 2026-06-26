# Disaster Recovery

MineOps disaster recovery depends on automated backups plus a manual restore workflow.

## Recovery Scenarios

### Bad World State

Use when the server world is damaged, griefed, or corrupted.

1. Stop new player activity.
2. Pick a known-good backup.
3. Validate the backup.
4. Run restore.
5. Confirm Minecraft is ready.
6. Ask players to verify the world.

### Failed Upgrade

Use when a Minecraft image or configuration change breaks startup.

1. Inspect Minecraft logs.
2. Revert the bad configuration through Terraform.
3. Apply Terraform.
4. Restore from backup only if world data was modified or corrupted.

### Cluster Rebuild

Use when recreating the local k3d cluster.

1. Keep `./backups` intact.
2. Recreate the cluster with `MINEOPS_BACKUP_HOST_PATH` set.
3. Run Terraform.
4. Bootstrap Secrets.
5. Restore a backup if the Minecraft PVC is empty.

## Backup Verification

Before restore:

```powershell
.\scripts\validate-backup.ps1 latest
```

Expected result:

```text
Backup Validation

Status:
PASS

Required Files:
PASS

Integrity:
PASS
```

## Restore Commands

Latest backup:

```powershell
.\scripts\restore.ps1 latest
```

Specific backup:

```powershell
.\scripts\restore.ps1 backup_2026-06-27_1-30-36
```

## Operational Notes

- Restore intentionally stops Minecraft.
- Restore does not delete backup folders.
- Restore does not run from Discord.
- Keep multiple backups when possible.
- Test restore after major platform changes.
