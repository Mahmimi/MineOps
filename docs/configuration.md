# Configuration

MineOps v1.0.0 uses `config/minecraft.yaml` as the Minecraft runtime source of truth.

Terraform reads this file directly with `yamldecode`.

## Supported Settings

```yaml
minecraft:
  type: PAPER
  version: LATEST

world:
  seed: "5063885805507972583"
  difficulty: normal
  mode: survival

server:
  memory: 4G
  onlineMode: true
  maxPlayers: 20

operators:
  - YourMinecraftUsername

backup:
  enabled: true
  interval: "*/30 * * * *"
  mode: append_with_limit
  limit: 5
```

## CLI

```powershell
.\mineops.ps1 validate
.\mineops.ps1 config show
.\mineops.ps1 config diff
```

## Imported Worlds

Imported worlds are authoritative.

MineOps may warn when runtime world metadata differs from `minecraft.yaml`, but it does not overwrite migrated world metadata automatically.
