# Changelog

## v1.1.0 - 2026-06-27

World persistence and clean-room recovery hardening.

### Added

- Stable `mineops-minecraft-data` hostPath PersistentVolume for Minecraft world data.
- Explicit `minecraft-data` PVC binding to the stable MineOps hostPath volume.
- `minecraft_host_path` Terraform variable for the stable in-node Minecraft data path.
- Docker build support for images that depend on shared `apps/utils` helpers.
- `apps/.dockerignore` for the wider Docker build context.

### Changed

- Minecraft world storage now survives full k3d cluster deletion when `.local/k3d/storage/mineops-minecraft-data` is preserved.
- Minecraft PV reclaim policy changed to `Retain` for safer clean-room rebuilds.
- Backups now default to append-only mode to avoid deleting older recovery points after a reset or rebuild.
- Discord bot Docker builds now use the `apps` context and copy shared utilities into the image.
- Discord bot image fingerprinting now includes both bot source and shared utilities.

### Fixed

- Fixed Discord bot crash on clean-room rebuild caused by missing `apps/utils/time.js` in the container image.
- Fixed clean-room rebuild behavior where Minecraft could start with a fresh dynamic local-path PV instead of durable MineOps world data.
- Prevented backup retention from removing the last known-good pre-reset backups after a new world is accidentally created.

### Validation

- Clean-room cluster recreation preserves current world data when the stable storage folder is kept.
- Existing backup folders are preserved across clean-room runs.
- Terraform validation passes.
- Discord bot and CLI syntax checks pass.

## v1.0.0 - 2026-06-24

Initial MineOps release candidate stabilization.

### Added

- Self-service clean-room install workflow.
- `config/minecraft.yaml` as the Minecraft runtime configuration source of truth.
- Terraform consumption of Minecraft runtime configuration through `yamldecode`.
- `mineops validate`.
- `mineops config show`.
- `mineops config diff`.
- `mineops update minecraft <version>`.
- World metadata drift warnings.
- Legacy world import workflow.
- Discord lifecycle commands:
  - `/start_server`
  - `/stop_server`
  - `/restart_server`
- MineOps admin allow-list via `mineops-admins.json`.
- Idle scale-to-zero state persistence.
- Operation lock service.
- Server lifecycle service.

### Changed

- Minecraft runtime settings moved out of hardcoded Terraform env values.
- Backup messages now retry and wait for Minecraft startup stabilization.
- Discord lifecycle RBAC is explicitly scoped to Minecraft lifecycle operations.

### Security

- RCON disabled.
- Admin authorization is MineOps-managed and does not trust Discord roles.
- Secrets and admin allow-list files are ignored by Git.

### Validation

- Terraform validates and plans clean.
- CLI and Discord bot syntax checks pass.
- Runtime health and doctor checks pass.
