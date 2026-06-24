# MineOps v1.0.0

MineOps is a self-service Minecraft platform for a local Kubernetes homelab.

It provides:

- k3d Kubernetes runtime
- Terraform-managed Minecraft infrastructure
- PVC-backed world storage
- host-persistent backups
- manual restore
- world import
- Discord operational bot
- Discord server lifecycle commands
- Playit public tunnel for player access
- idle scale-to-zero
- operator CLI

## Prerequisites

Install these tools on the host:

- Docker Desktop
- k3d
- kubectl
- Terraform
- Node.js 20 or newer
- PowerShell

Verify:

```powershell
docker ps
k3d version
kubectl version --client
terraform version
node --version
```

## Clone

```powershell
git clone https://github.com/Mahmimi/MineOps
cd MineOps
```

## Configure Secrets

Create `.env`:

```powershell
Copy-Item .env.example .env
notepad .env
```

Required values:

```text
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
PLAYIT_SECRET_KEY=
```

Optional values:

```text
DISCORD_ALERT_CHANNEL_ID=
PLAYIT_JOIN_ADDRESS=
MINEOPS_STORAGE_PATH=.local/k3d/storage
MINEOPS_BACKUP_HOST_PATH=./backups
IDLE_SHUTDOWN_ENABLED=true
IDLE_SHUTDOWN_MINUTES=30
```

## Configure Minecraft

Edit:

```text
config/minecraft.yaml
```

Example:

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

Validate:

```powershell
mineops validate
mineops config show
```

## Configure Discord Admins

Only MineOps admins can run `/stop_server` and `/restart_server`.

```powershell
Copy-Item mineops-admins.json.example mineops-admins.json
notepad mineops-admins.json
```

Example:

```json
{
  "admins": [
    {
      "username": "Mahmimi",
      "discordUserId": "12345"
    }
  ]
}
```

`mineops-admins.json` is ignored by Git.

## Create Cluster

```powershell
mineops init
mineops cluster create
```

## Bootstrap Secrets

`mineops init` validates local tools and applies secrets when the namespace exists.

Run it again after cluster creation:

```powershell
mineops init
```

## Deploy

```powershell
mineops deploy
```

This builds the Discord bot image, imports it into k3d, applies Terraform, bootstraps secrets, applies Kubernetes manifests, and waits for rollout.

## Validate

```powershell
mineops status
mineops playit
mineops health
mineops doctor
mineops metrics
terraform -chdir=infra/terraform plan
```

Terraform should report:

```text
No changes.
```

## First Backup

```powershell
mineops backup
mineops backups
```

Backups are stored under:

```text
./backups
```

## First Restore

Restore is an administrative CLI operation.

```powershell
mineops restore latest
```

## Import Existing World

Stop Minecraft first:

```powershell
mineops stop minecraft
mineops import world "D:\minecraft-server\data"
mineops start minecraft
```

MineOps refuses import while Minecraft or backup operations are active.

Imported world metadata is authoritative. MineOps warns about drift but does not overwrite migrated world metadata automatically.

## Update Minecraft

```powershell
mineops update minecraft LATEST
mineops update minecraft 1.21.1
```

The workflow validates the version, creates a backup, updates `config/minecraft.yaml`, applies Terraform, restarts Minecraft, waits for readiness, and emits an event.

## Discord Commands

Visibility:

- `/status`
- `/server`
- `/playit`
- `/players`
- `/dashboard`
- `/backups`
- `/events`
- `/alerts`
- `/help`

Lifecycle:

- `/start_server`
- `/stop_server`
- `/restart_server`

`/start_server` is open to everyone.

`/stop_server` and `/restart_server` require `mineops-admins.json`.

## Security Model

- Secrets stay in `.env` and Kubernetes Secrets.
- Admin IDs stay in ignored `mineops-admins.json`.
- Discord lifecycle RBAC is namespace-scoped.
- Discord can only operate the Minecraft Deployment lifecycle.
- Discord cannot run Terraform.
- Discord cannot run arbitrary kubectl.
- Discord cannot run arbitrary Minecraft commands.
- RCON is disabled.

## Documentation

- [Architecture](docs/architecture.md)
- [CLI](docs/cli.md)
- [Configuration](docs/configuration.md)
- [Minecraft Upgrades](docs/minecraft-upgrades.md)
- [Server Lifecycle](docs/server-lifecycle.md)
- [World Migration](docs/world-migration.md)
- [Backups](docs/backup.md)
- [Restore](docs/restore.md)
- [Discord UX](docs/discord-ux.md)
- [Monitoring and Alerting](docs/monitoring-alerting.md)
- [Secrets](docs/secret-management.md)
- [Changelog](CHANGELOG.md)
