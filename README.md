# MineOps

MineOps is a Kubernetes-based Minecraft platform for a local homelab.

It runs a Minecraft server, Playit tunnel agent, automated world backups, manual restore tooling, read-only Discord ChatOps, durable alert history, and lightweight monitoring on a local k3d cluster. Infrastructure is managed with Terraform, while secrets stay local and out of Git.

## Features

- Minecraft server using `itzg/minecraft-server`
- Playit tunnel agent using `ghcr.io/playit-cloud/playit-agent`
- Local Kubernetes cluster with k3d
- Terraform-managed runtime resources
- Persistent Minecraft world storage
- Host-persistent backup storage under `./backups`
- Automated backups every 30 minutes
- Backup retention modes: `replace`, `append`, `append_with_limit`
- Manual restore workflow for latest or timestamped backups
- Read-only Discord commands with embeds:
  - `/status`
  - `/players`
  - `/server`
- Discord alert channel support
- Durable alert, event, timeline, and maintenance state on a PVC
- MineOps CLI for deploy, status, metrics, doctor, dashboard, timeline, backups, events, alerts, and maintenance
- Minecraft Query Protocol for player counts and player names
- Local `.env` based secret bootstrap workflow

## Repository Layout

```text
MineOps/
|-- apps/
|   |-- discord-bot/            # read-only Discord bot service
|   `-- mineops-cli/            # operator CLI
|-- backups/
|   `-- .gitkeep                # host backup folder skeleton
|-- docs/                       # public project documentation
|-- infra/
|   |-- k3d/                    # local cluster config
|   `-- terraform/              # Kubernetes infrastructure
|-- platform/
|   |-- kubernetes/             # Kubernetes manifests
|   `-- monitoring/             # monitoring foundation docs/resources
|-- scripts/                    # local helper scripts used by CLI
|-- mineops
|-- mineops.cmd
|-- mineops.ps1
|-- .env.example
|-- .gitignore
|-- LICENSE
`-- README.md
```

## Quick Start

Prerequisites:

- Docker
- k3d
- kubectl
- Terraform
- Node.js 20+

Prepare local configuration:

```powershell
cd D:\MineOps
Copy-Item .env.example .env
notepad .env
```

Run the platform workflow through the CLI:

```powershell
.\mineops.ps1 init
.\mineops.ps1 cluster create
.\mineops.ps1 deploy
.\mineops.ps1 status
.\mineops.ps1 metrics
.\mineops.ps1 doctor
.\mineops.ps1 dashboard --once
.\mineops.ps1 timeline
.\mineops.ps1 backups
.\mineops.ps1 alerts
.\mineops.ps1 events
.\mineops.ps1 maintenance on
.\mineops.ps1 maintenance off
```

Common operations:

```powershell
.\mineops.ps1 backup
.\mineops.ps1 restore latest
.\mineops.ps1 logs minecraft
.\mineops.ps1 logs discord
```

## Documentation

- [Architecture](docs/architecture.md)
- [CLI](docs/cli.md)
- [Deployment](docs/deployment.md)
- [Operations](docs/operations.md)
- [User Guide](docs/user-guide.md)
- [Backups](docs/backup.md)
- [Restore](docs/restore.md)
- [Disaster Recovery](docs/disaster-recovery.md)
- [Discord UX](docs/discord-ux.md)
- [Monitoring and Alerting](docs/monitoring-alerting.md)
- [Phase 5 Validation](docs/phase-5-validation.md)
- [Secrets](docs/secret-management.md)

## Data And Secret Safety

Do not commit:

- `.env`
- Terraform state
- kubeconfig files
- Minecraft world data
- backup contents
- Discord or Playit tokens

The repository tracks only the backup folder skeleton:

```text
backups/.gitkeep
```

Backup contents are ignored by Git.
