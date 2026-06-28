# mineops.yaml Specification

`mineops.yaml` is the new single source of truth for MineOps platform deployments. Legacy files remain supported through the legacy adapter for migration.

## Example

```yaml
apiVersion: mineops/v1

cluster:
  name: mineops-local

globals:
  timezone: Asia/Bangkok
  storagePath: D:/MineOps/storage
  backupHostPath: D:/MineOps/backups

instances:
  survival:
    namespace: mineops-survival
    services:
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
          - Jiranuwat
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
      discord:
        token: ${DISCORD_TOKEN_SURVIVAL}
        clientId: ${DISCORD_CLIENT_ID_SURVIVAL}
        guildId: ${DISCORD_GUILD_ID}
        alertChannelId: ${DISCORD_ALERT_CHANNEL_ID_SURVIVAL}
        admins:
          admins: []
      playit:
        secretKey: ${PLAYIT_SECRET_KEY_SURVIVAL}
        joinAddress: ""
      backup:
        hostPath: D:/MineOps/backups/survival
        enabled: true
        interval: "*/30 * * * *"
        mode: append
        limit: 5

  creative:
    namespace: mineops-creative
    services:
      minecraft:
        type: PAPER
        version: LATEST
        world:
          seed: "8675309"
          difficulty: normal
          mode: creative
        server:
          memory: 4G
          onlineMode: true
          maxPlayers: 20
        operators:
          - Jiranuwat
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
      discord:
        token: ${DISCORD_TOKEN_CREATIVE}
        clientId: ${DISCORD_CLIENT_ID_CREATIVE}
        guildId: ${DISCORD_GUILD_ID}
        alertChannelId: ${DISCORD_ALERT_CHANNEL_ID_CREATIVE}
        admins:
          admins: []
      playit:
        secretKey: ${PLAYIT_SECRET_KEY_CREATIVE}
        joinAddress: ""
      backup:
        hostPath: D:/MineOps/backups/creative
        enabled: true
        interval: "*/30 * * * *"
        mode: append
        limit: 5
```

## Notes

Use forward slashes for Windows paths in YAML, for example `D:/MineOps/backups/survival`.

Environment references use `${NAME}` and are resolved before validation.

Each instance should use a unique namespace. For public tunnels, each instance should use its own Playit secret. For Discord separation, each instance can use a different bot token, application client ID, guild, and alert channel.