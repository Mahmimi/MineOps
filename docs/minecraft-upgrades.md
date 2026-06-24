# Minecraft Upgrades

MineOps upgrades are configuration-driven.

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
4. Applies Terraform.
5. Restarts Minecraft.
6. Waits for readiness.
7. Checks runtime config drift.
8. Emits a lifecycle event.

## Idempotency

If the requested version already matches `config/minecraft.yaml`, MineOps exits without backup, Terraform, or restart.

## Rollback

If the upgrade fails:

1. Restore the previous backup.
2. Set `minecraft.version` back in `config/minecraft.yaml`.
3. Run:

```powershell
terraform -chdir=infra/terraform apply
.\mineops.ps1 restart minecraft
```
