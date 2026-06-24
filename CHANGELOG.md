# Changelog

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
