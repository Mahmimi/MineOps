# MineOps

MineOps is a Kubernetes-based Minecraft platform for a local homelab.

It runs a Minecraft server, Playit tunnel agent, automated world backups, and a read-only Discord ChatOps bot on a local k3d cluster. Infrastructure is managed with Terraform, while secrets stay local and out of Git.

## Features

- Minecraft server using `itzg/minecraft-server`
- Playit tunnel agent using `ghcr.io/playit-cloud/playit-agent`
- Local Kubernetes cluster with k3d
- Terraform-managed runtime resources
- Persistent Minecraft world storage
- Host-persistent backup storage under `./backups`
- Automated backups every 30 minutes
- Backup retention modes: `replace`, `append`, `append_with_limit`
- Read-only Discord commands:
  - `/status`
  - `/players`
  - `/server`
- Minecraft Query Protocol for player counts and player names
- Local `.env` based secret bootstrap workflow

## Repository Layout

```text
MineOps/
|-- .github/
|   `-- workflows/              # CI checks
|-- apps/
|   `-- discord-bot/            # read-only Discord bot service
|-- backups/
|   `-- .gitkeep                # host backup folder skeleton
|-- docs/                       # public project documentation
|-- infra/
|   |-- k3d/                    # local cluster config
|   `-- terraform/              # Kubernetes infrastructure
|-- platform/
|   `-- kubernetes/             # reference Kubernetes manifests
|-- scripts/                    # local helper scripts
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
- Node.js and npm, for building the Discord bot

Create local folders and environment variables:

```powershell
cd D:\MineOps

Copy-Item .env.example .env
notepad .env

New-Item -ItemType Directory -Force .\.local\k3d\storage
New-Item -ItemType Directory -Force .\backups

$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
$env:MINEOPS_BACKUP_HOST_PATH = (Resolve-Path .\backups).Path
```

Create the cluster:

```powershell
k3d cluster create --config infra/k3d/local.yaml
```

Apply infrastructure:

```powershell
cd infra\terraform
terraform init
terraform apply
```

Create runtime secrets:

```powershell
cd D:\MineOps
.\scripts\validate-env.ps1
.\scripts\bootstrap-secrets.ps1
```

Build and load the Discord bot image:

```powershell
docker build -t mineops-discord-bot:phase3.5 apps\discord-bot
k3d image import mineops-discord-bot:phase3.5 -c mineops-local
kubectl apply -f platform\kubernetes\discord-bot --recursive
```

Check runtime:

```powershell
kubectl get pods -n mineops
kubectl get cronjob -n mineops
```

## Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Operations](docs/operations.md)
- [User Guide](docs/user-guide.md)
- [Backups](docs/backup.md)
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
