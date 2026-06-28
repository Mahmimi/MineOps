# Configuration Adapters

Configuration adapters are the only code allowed to read external configuration files.

## Current Adapters

- `MineOpsYamlAdapter`
- `LegacyConfigAdapter`

## Responsibilities

An adapter may:

- read files
- load `.env`
- resolve `${NAME}` references
- apply edge defaults
- map input into raw MineOps-shaped data

An adapter may not:

- run Terraform
- mutate the cluster
- hide invalid input from schema validation

## YAML Adapter

`MineOpsYamlAdapter`:

- reads `mineops.yaml`
- loads optional `.env`
- resolves environment references
- maps `instances.<name>.services.*` into normalized service configs
- derives global env values such as timezone and storage paths

## Legacy Adapter

`LegacyConfigAdapter`:

- reads `.env`
- reads `config/minecraft.yaml`
- reads optional `mineops-admins.json`
- converts them into a synthetic single `default` instance

Legacy support exists for migration. It should not shape new architecture decisions.

## Why This Boundary Matters

The adapter boundary prevents infrastructure code from growing hidden dependencies on file layout or legacy compatibility.

## Adding A New Adapter

1. implement `ConfigAdapter.loadRaw()`
2. return raw MineOps-shaped data
3. let schema validation reject invalid input
4. ensure downstream services do not need to know which adapter produced the config

## Related

- [Configuration System](../architecture/configuration-system.md)
- [Legacy To mineops.yaml](../migration/legacy-to-mineops-yaml.md)
