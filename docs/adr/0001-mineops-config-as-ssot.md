# ADR 0001: MineOpsConfig as the Internal Source of Truth

## Status

Accepted

## Context

MineOps started as a local operator workflow for one Minecraft deployment stack. Configuration was spread across `.env`, `config/minecraft.yaml`, `mineops-admins.json`, Terraform locals, and runtime bootstrap scripts. That worked for a single instance, but it made future `mineops.yaml`, multi-instance deployment, and additional platform services difficult because infrastructure code could discover configuration independently from the application layer.

MineOps is evolving into a small platform that can eventually deploy one or many MineOps instances. Each instance may include Minecraft, Discord, Playit, Backup, and future services. The internal architecture must therefore treat desired platform state as a domain model, not as a collection of files.

## Decision

`MineOpsConfig` is the canonical internal domain model for desired MineOps platform state.

Configuration files and other external sources are input adapters only. A configuration adapter may read external input, normalize it, resolve environment-derived values, and produce raw MineOps-shaped input. That input is validated before `MineOpsConfig` is constructed.

Deployment components must not read configuration files directly. They receive `MineOpsConfig`, `InstanceConfig`, or generated artifacts derived from those immutable domain objects.

Fail-fast validation happens before infrastructure actions. Invalid configuration should stop before Docker, k3d, Terraform, kubectl, or runtime bootstrap scripts are executed.

Infrastructure must consume generated artifacts instead of discovering configuration itself. Terraform, Kubernetes secret/config generation, runtime bootstrap, and future manifest generation should receive explicit inputs derived from `MineOpsConfig`.

## Rationale

This keeps dependency flow one-directional:

```text
Configuration adapters
  -> resolution
  -> validation
  -> immutable MineOpsConfig
  -> application/deployment
  -> infrastructure executors
```

This prevents hidden coupling between deployment logic and file formats. It also means that replacing legacy files with `mineops.yaml` becomes an adapter change instead of a deployment rewrite.

Fail-fast validation makes failures safer and clearer. Operators should see missing fields, invalid enum values, malformed cron expressions, invalid resource quantities, duplicate instance names, or invalid namespaces before MineOps mutates a cluster.

Generated infrastructure artifacts make Terraform and runtime scripts consumers instead of sources of truth. This avoids split-brain configuration where Terraform reads one file while the CLI or runtime bootstrap reads another.

## Consequences

All future configuration sources must produce the same validated `MineOpsConfig` shape. Examples include legacy files, future `mineops.yaml`, generated test config, remote config, or API-provided config.

All deployment code must accept injected configuration or generated artifacts. Direct reads of `.env`, `config/minecraft.yaml`, and `mineops-admins.json` are limited to configuration adapters until those legacy inputs are retired.

Terraform and runtime bootstrap migration should preserve generated resources and user behavior while moving their inputs to generated artifacts derived from `MineOpsConfig`.

The architecture prepares MineOps for:

- `mineops.yaml` as the future user-facing SSOT
- multiple instances represented by `config.instances`
- instance-specific namespaces, secrets, config maps, PVCs, backups, and runtime config
- pluggable platform services
- pure deployment planning followed by infrastructure execution
- easier unit testing through generated or in-memory config adapters

## Compatibility

The current user experience remains unchanged. Existing `.env`, `config/minecraft.yaml`, and `mineops-admins.json` continue to work through the legacy configuration adapter until the migration to `mineops.yaml` is intentionally introduced.