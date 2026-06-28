# Quick Start

This path gets a MineOps platform from configuration to a running cluster.

## 1. Create `mineops.yaml`

Start with one instance and keep secrets in environment variables:

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
          - ${MINECRAFT_OPERATOR_USERNAME}
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
        token: ${DISCORD_TOKEN}
        clientId: ${DISCORD_CLIENT_ID}
        guildId: ${DISCORD_GUILD_ID}
        alertChannelId: ${DISCORD_ALERT_CHANNEL_ID}
        admins:
          admins: []
      playit:
        secretKey: ${PLAYIT_SECRET_KEY}
        joinAddress: ${PLAYIT_JOIN_ADDRESS}
      backup:
        enabled: true
        interval: "*/30 * * * *"
        mode: append
        limit: 5
```

## 2. Provide Secrets

Set the variables in your shell or a local `.env` file:

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
DISCORD_ALERT_CHANNEL_ID=
PLAYIT_SECRET_KEY=
PLAYIT_JOIN_ADDRESS=
MINECRAFT_OPERATOR_USERNAME=
```

## 3. Validate

```powershell
mineops validate
mineops config graph
```

## 4. Deploy

```powershell
mineops init
```

The deployment flow is idempotent. Re-running it reconciles the desired state instead of starting over.

## 5. Inspect The Platform

```powershell
mineops status
mineops doctor
mineops playit
mineops backups
```

## 6. Operate The Instance

```powershell
mineops backup
mineops logs minecraft
mineops stop minecraft
mineops start minecraft
```

Next: [First Server](first-server.md)
