# Minecraft Upgrades

MineOps upgrades are explicit operator actions. Terraform creates the initial Minecraft runtime from `config/minecraft.yaml`, but later deploys intentionally preserve the existing Minecraft pod template so routine platform deploys do not roll the server back or rewrite runtime metadata.

## Command

```powershell
.\mineops.ps1 update minecraft <version>
```

Examples:

```powershell
.\mineops.ps1 update minecraft LATEST
.\mineops.ps1 update minecraft 1.21.1
```

## Workflow

The command:

1. Validates the target version.
2. Creates a backup.
3. Patches `config/minecraft.yaml`.
4. Patches the live Minecraft Deployment `VERSION` environment variable.
5. Waits for rollout when Minecraft is running.
6. Checks runtime config drift.
7. Emits a lifecycle event.

## Idempotency

If the requested version already matches the live Minecraft Deployment, MineOps exits without backup or rollout. If only `config/minecraft.yaml` is stale, MineOps syncs the file without touching the running server.

## Rollback

If the upgrade fails:

1. Restore the previous backup.
2. Set `minecraft.version` back in `config/minecraft.yaml`.
3. Run:

```powershell
.\mineops.ps1 update minecraft <previous-version>
```
