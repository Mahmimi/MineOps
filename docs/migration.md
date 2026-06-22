# MineOps Migration Guide

The current Docker Compose deployment is preserved under `legacy/docker-compose/`.

Phase 2 creates Kubernetes runtime resources but does not automatically copy world data. This is intentional: Minecraft world data must be migrated only after a clean stop, a verified backup, and an explicit operator action.

## Preserved Legacy Paths

- `legacy/docker-compose/minecraft-localhost/data`
- `legacy/docker-compose/minecraft-localhost/data-backup`

Do not modify these paths during normal Terraform deployment.

## Migration Procedure

1. Announce maintenance and stop player activity.
2. Stop the legacy Minecraft server cleanly:

   ```bash
   cd legacy/docker-compose/minecraft-localhost
   docker compose down
   ```

3. Create a fresh timestamped backup of the full `data` directory.
4. Verify the backup contains:
   - `world/level.dat`
   - player data
   - server properties
   - ops and whitelist files
   - plugins and plugin configs
   - logs
5. Create or apply the Kubernetes runtime foundation with Terraform.
6. Confirm the `minecraft-data` PVC is Bound.
7. Copy data from the verified backup into the PVC using a deliberate one-time migration method.
8. Start or restart the Kubernetes Minecraft Deployment.
9. Validate world load, player inventories, ops, whitelist, plugins, and connectivity.
10. Keep the legacy folder and all backups until Kubernetes backup and restore are tested.

## Important Warning

If the Kubernetes Minecraft pod starts before the legacy world is copied, the container may initialize a new empty world on the PVC. That does not modify the legacy world, but it means the PVC must be cleaned or replaced before copying the legacy world into it.

## Out Of Scope For Phase 2

- automated data copy
- automated backup jobs
- restore automation
- Discord bot commands
- controller service
- scale-to-zero
