# Deployment

MineOps uses a single idempotent deployment command:

```powershell
.\mineops.ps1 init
```

Running the command repeatedly is safe. Existing clusters are reused, existing Kubernetes resources are reconciled, unchanged images are not rebuilt, and existing Minecraft runtime metadata is preserved after the initial Terraform creation.

## Prerequisites

- Docker
- k3d
- kubectl
- Terraform
- Node.js and npm
- PowerShell
- Discord bot token
- Discord application client ID
- Discord test server guild ID
- Playit secret key

## Configure

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
```

Optional values:

```env
DISCORD_ALERT_CHANNEL_ID=
PLAYIT_JOIN_ADDRESS=
MINEOPS_STORAGE_PATH=.local/k3d/storage
MINEOPS_BACKUP_HOST_PATH=./backups
MINEOPS_TIME_ZONE=
IDLE_SHUTDOWN_ENABLED=true
IDLE_SHUTDOWN_MINUTES=30
```

Leave `MINEOPS_TIME_ZONE` empty to let `mineops init` derive the host timezone. Set it explicitly to an IANA timezone such as `Asia/Bangkok` if you want to pin runtime timestamps.

Edit Minecraft configuration in:

```text
config/minecraft.yaml
```

## Initialize

```powershell
.\mineops.ps1 init
```

The orchestrator performs these steps:

1. Validate OS, required tools, Docker, `.env`, and `config/minecraft.yaml`.
2. Create the k3d cluster only if it does not already exist.
3. Prepare host storage/backup folders.
4. Build the Discord bot image only when the source fingerprint changes.
5. Load the image into k3d only when needed.
6. Reconcile Terraform infrastructure.
7. Inject runtime Secrets and ConfigMaps.
8. Reconcile Discord bot Kubernetes manifests.
9. Wait for Minecraft, Playit, and Discord bot workloads.
10. Print a concise deployment summary.

## Architecture

The `init` command is presentation-only. It delegates to `DeploymentOrchestrator`, which coordinates dedicated services:

- `RequirementValidator`: OS, tool, Docker, environment, and config checks.
- `ClusterManager`: create or reuse the k3d cluster.
- `EnvironmentManager`: host directories and runtime Secret/ConfigMap injection.
- `ImageBuilder`: source fingerprinting, Docker build, and k3d image loading.
- `DeploymentManager`: Terraform and Kubernetes manifest reconciliation.
- `HealthChecker`: final Minecraft, Playit, Discord bot, and backup checks.

Image and runtime config fingerprints are stored under `.mineops/`. They let repeated `init` runs skip unchanged Docker builds, k3d image loads, and config-driven workload restarts.

## Runtime Idempotency

Terraform creates the Minecraft PVC and initial Deployment. After first creation, existing Minecraft runtime metadata is protected from routine deploys. Use:

```powershell
.\mineops.ps1 update minecraft <version>
```

for Minecraft version changes.

## Explicit Cluster Reset

Cluster recreation is intentionally separate and destructive:

```powershell
.\mineops.ps1 cluster recreate
.\mineops.ps1 init
```
