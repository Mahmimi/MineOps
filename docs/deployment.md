# Deployment

This guide deploys MineOps to a local k3d cluster.

## Prerequisites

- Docker
- k3d
- kubectl
- Terraform
- Node.js and npm
- Discord bot token
- Discord application client ID
- Discord test server guild ID
- Playit secret key

## 1. Configure Local Environment

From the repository root:

```powershell
Copy-Item .env.example .env
notepad .env
```

Required values:

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
PLAYIT_SECRET_KEY=
MINEOPS_STORAGE_PATH=.local/k3d/storage
MINEOPS_BACKUP_HOST_PATH=./backups
```

Create local host folders:

```powershell
New-Item -ItemType Directory -Force .\.local\k3d\storage
New-Item -ItemType Directory -Force .\backups
```

Export absolute paths for k3d:

```powershell
$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
$env:MINEOPS_BACKUP_HOST_PATH = (Resolve-Path .\backups).Path
```

## 2. Create Cluster

```powershell
k3d cluster create --config infra/k3d/local.yaml
```

Verify:

```powershell
kubectl cluster-info
kubectl get nodes
```

## 3. Apply Terraform

```powershell
cd infra\terraform
terraform init
terraform fmt
terraform validate
terraform apply
```

## 4. Bootstrap Secrets

```powershell
cd D:\MineOps
.\scripts\validate-env.ps1
.\scripts\bootstrap-secrets.ps1
```

This creates:

- `discord-bot-secret`
- `playit-secret`

## 5. Deploy Discord Bot

```powershell
docker build -t mineops-discord-bot:phase3.5 apps\discord-bot
k3d image import mineops-discord-bot:phase3.5 -c mineops-local
kubectl apply -f platform\kubernetes\discord-bot --recursive
```

## 6. Validate

```powershell
kubectl get pods -n mineops
kubectl get svc -n mineops
kubectl get cronjob -n mineops
kubectl logs -n mineops deployment/discord-bot
```

Expected:

- Minecraft pod is running.
- Discord bot pod is running.
- Backup CronJob exists.
- Discord bot logs show command registration.

## Recreate Cluster

To recreate the local platform:

```powershell
cd D:\MineOps

$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
$env:MINEOPS_BACKUP_HOST_PATH = (Resolve-Path .\backups).Path

k3d cluster delete mineops-local
k3d cluster create --config infra/k3d/local.yaml

cd infra\terraform
terraform apply

cd D:\MineOps
.\scripts\bootstrap-secrets.ps1
docker build -t mineops-discord-bot:phase3.5 apps\discord-bot
k3d image import mineops-discord-bot:phase3.5 -c mineops-local
kubectl apply -f platform\kubernetes\discord-bot --recursive
```
