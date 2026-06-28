# Changelog

## v1.2.0 - 2026-06-28

Multi-MineOps Instances with SSOT YAML.

### Added

- Introduced `mineops.yaml` as the MineOps single source of truth (SSOT)
- Added full multi-instance configuration support
- Added instance-aware CLI execution model
- Added `InstanceResolver` for:
  - `--instance`
  - `--all`
  - default target resolution
  - ambiguity detection
  - explicit unsafe-operation targeting
- Added `mineops shell <minecraft|discord|playit> --instance <name>`
- Added instance-aware config inspection:
  - `mineops config show --instance <name>`
  - `mineops config graph`

### Changed

- Refactored the CLI from singleton-oriented execution to instance-first execution
- Refactored service construction so operational services no longer bind to one namespace at startup
- Updated core operational services to execute against `InstanceConfig`
- Updated Terraform generation for multi-instance deployments
- Updated runtime artifact generation for per-instance secrets and config
- Updated Discord bot deployment/runtime wiring for per-instance command and alert behavior
- Updated resource targeting to derive from config/domain naming rather than ad hoc namespace assumptions

### CLI Improvements

- `status`, `logs`, `backup`, `backups`, `doctor`, `health`, `playit`, `maintenance`, `alerts`, and `timeline` now support instance-aware targeting
- Safe commands now support `--all` where appropriate
- Ambiguous commands now fail fast instead of silently choosing one instance
- Unsafe commands now require explicit target selection:
  - `mineops import --instance <name> ...`
  - `mineops restore --instance <name> ...`

### Import and Operations

- Reworked `mineops import` into an instance-aware workflow
- Import flow now:
  - validates the source
  - detects world layout
  - stops Minecraft
  - waits for termination
  - mounts the PVC
  - copies world data
  - preserves ownership/permissions
  - verifies `level.dat`
  - restarts Minecraft
  - waits for readiness
  - verifies runtime health

### Fixed

- Fixed `.env` resolution for `mineops.yaml` variable substitution
- Fixed Terraform drift for runtime-managed Playit secret labels
- Fixed Discord command channel isolation when shared bot credentials are used across instances
- Fixed Discord admin allow-list runtime config handling
- Fixed CLI backup path resolution for per-instance backup directories
- Fixed Terraform formatting issues in `infra/terraform/main.tf`

### Breaking Changes

- Multi-instance environments now require explicit instance selection for unsafe commands
- Commands that were previously singleton-defaulting may now fail with ambiguity until `--instance` or `--all` is provided
- Operational usage is now centered on `mineops.yaml` SSOT rather than legacy singleton assumptions

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
