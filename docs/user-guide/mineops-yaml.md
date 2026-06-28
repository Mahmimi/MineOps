# `mineops.yaml`

`mineops.yaml` is the external single source of truth for MineOps platform configuration.

MineOps does not deploy directly from YAML. A configuration adapter reads the file, resolves environment-variable references, validates the shape, and produces immutable `MineOpsConfig` and `InstanceConfig` domain objects.

See [configuration system](../architecture/configuration-system.md) for the internal flow.

## Top-Level Shape

```yaml
apiVersion: mineops/v1

cluster:
  name: mineops

globals:
  timezone: Asia/Bangkok
  storagePath: D:/MineOps/production/storage
  backupHostPath: D:/MineOps/production/backups

instances:
  survival:
    namespace: mineops-survival
    services:
      minecraft: {}
      discord: {}
      playit: {}
      backup: {}
```

## Semantics

- `cluster.name`: target k3d cluster name used by the CLI
- `globals.timezone`: human-facing timezone for logs, events, alerts, and backup timestamps
- `globals.storagePath`: host directory mounted into the cluster for persistent Minecraft storage
- `globals.backupHostPath`: host directory mounted into the cluster for backups
- `instances`: map of instance names to isolated deployments

## Environment Variable References

MineOps resolves `${NAME}` placeholders before validation:

```yaml
discord:
  token: ${DISCORD_TOKEN}
  clientId: ${DISCORD_CLIENT_ID}
```

Resolution order is:

1. values from local `.env` when present
2. current process environment

Missing variables resolve to empty strings, then fail validation if the target field is required.

## Instance Services

Each instance currently supports four service types:

- `minecraft`
- `discord`
- `playit`
- `backup`

The adapter normalizes them into service configs inside `InstanceConfig.services`.

## Minecraft Service

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
    - Alice
  backup:
    enabled: true
    interval: "*/30 * * * *"
    mode: append
    limit: 5
  storage:
    size: 20Gi
  resources:
    requests:
      cpu: 1000m
      memory: 5Gi
    limits:
      cpu: 3000m
      memory: 6Gi
```

## Discord Service

```yaml
discord:
  token: ${DISCORD_TOKEN}
  clientId: ${DISCORD_CLIENT_ID}
  guildId: ${DISCORD_GUILD_ID}
  alertChannelId: ${DISCORD_ALERT_CHANNEL_ID}
  admins:
    admins:
      - username: admin
        discordUserId: "1234567890"
```

The admin allow-list becomes a generated runtime ConfigMap. It is not a separate source of truth anymore.

## Playit Service

```yaml
playit:
  secretKey: ${PLAYIT_SECRET_KEY}
  joinAddress: ${PLAYIT_JOIN_ADDRESS}
```

## Backup Service

```yaml
backup:
  enabled: true
  interval: "*/30 * * * *"
  mode: append
  limit: 5
  hostPath: D:/MineOps/production/backups/survival
```

If `hostPath` is omitted, MineOps derives the per-instance backup directory from `globals.backupHostPath`.

If `mode` is `append` and `limit` is set, MineOps retains only the newest `limit` backups. `append_with_limit` remains accepted for backward compatibility.

## Validation Rules

Current validation includes:

- at least one instance
- unique instance names
- unique namespaces
- valid Kubernetes namespace names
- valid cron expressions
- valid CPU, memory, and storage quantities
- required Discord and Playit secrets
- required backup limit when `mode` is `append_with_limit`

Use:

```powershell
mineops validate
mineops config validate --all
```

## Related

- [Multi-instance](multi-instance.md)
- [Commands](commands.md)
- [Configuration System](../architecture/configuration-system.md)
