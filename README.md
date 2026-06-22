# MineOps

MineOps is a ChatOps-driven Minecraft platform for a local Kubernetes homelab.

The project is migrating from a legacy Docker Compose deployment into a cleaner Platform Engineering repository layout built around Docker, k3d, Kubernetes, Terraform, and future Discord-driven operations.

## Current Status

MineOps is in the Platform Stabilization phase before Phase 3.

Implemented:

- legacy Docker Compose assets preserved under `legacy/docker-compose/`
- existing Minecraft world data preserved in place
- existing backups preserved in place
- deterministic k3d local cluster configuration
- Terraform-managed Minecraft runtime foundation
- Terraform-managed placeholder Playit Secret
- Playit Deployment disabled by default for credential-free validation
- platform Kubernetes manifest references
- runtime, stabilization, rebuild, and migration documentation
- GitHub Actions foundations for Terraform format checks and markdown lint placeholder

Not implemented yet:

- Discord bot
- MineOps controller
- automated backup or restore jobs
- deployment pipeline
- scale-to-zero automation

## Repository Layout

```text
MineOps/
|-- .github/
|   `-- workflows/              # CI foundations
|-- apps/
|   `-- discord-bot/            # future ChatOps service
|-- docs/                       # architecture, migration, operations, and reports
|-- infra/
|   |-- k3d/                    # local Kubernetes cluster configuration
|   `-- terraform/              # Terraform runtime foundation
|-- legacy/
|   |-- docker-compose/         # preserved legacy Compose deployment
|   `-- kubernetes/             # archived early Kubernetes manifests
|-- platform/
|   |-- kubernetes/             # Kubernetes resource references
|   |-- helm/                   # future Helm charts or values
|   `-- manifests/              # future raw/shared manifests
|-- .gitignore
|-- LICENSE
`-- README.md
```

## Folder Responsibilities

`legacy/` keeps the original deployment history and data source safe during migration. The current Minecraft world and backups live here and should not be modified casually.

`infra/k3d/` defines the local development Kubernetes cluster. The config exposes the Kubernetes API at `https://localhost:6550`, maps Minecraft port `25565`, and prepares host-backed storage.

`infra/terraform/` manages the `mineops` namespace, `minecraft-data` PVC, Minecraft Deployment, Minecraft Service, placeholder Playit Secret, and Playit Deployment.

`platform/kubernetes/` contains plain Kubernetes manifest references grouped by component:

- `minecraft/`
- `playit/`
- `storage/`
- `backup/`
- `automation/`

`apps/discord-bot/` is reserved for the future ChatOps service.

`docs/` contains architecture, migration notes, operational guidance, and validation reports.

## Local Cluster

```bash
New-Item -ItemType Directory -Force .\.local\k3d\storage
$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
k3d cluster create --config infra/k3d/local.yaml
```

Expected kubeconfig endpoint:

```text
https://localhost:6550
```

No manual kubeconfig editing should be required.

## Terraform

```bash
cd infra/terraform
terraform init
terraform fmt -check -recursive
terraform validate
terraform plan
terraform apply
```

Default validation does not require real Playit credentials. Playit is scaled to `0` replicas unless a local ignored override enables it with a non-production token.

## Data Safety

Minecraft world data is the most important asset in this repository.

Do not:

- commit live world data
- commit backups
- commit secrets
- mount Kubernetes workloads directly against the preserved legacy data path
- run migration steps without a fresh backup

Before any future Kubernetes migration:

1. Stop the legacy Minecraft server cleanly.
2. Create a timestamped backup of the full live data directory.
3. Verify the backup contains world, player, config, plugin, and log data.
4. Copy from the verified backup into Kubernetes-owned storage.
5. Keep the legacy data and backups until restore has been tested.

## Kubernetes Strategy

Minecraft currently runs as a single-replica Deployment with `Recreate` strategy and a single RWO PVC. Keep replicas constrained to `0` or `1`.

The current recommendation is to keep Deployment for Phase 3 and revisit StatefulSet after backup/restore and controller workflows become more advanced.

## Future Expansion

Planned future areas:

- Discord bot for ChatOps
- backup scheduler
- restore workflow
- non-production secret injection workflow
- optional External Secrets, SOPS, or Sealed Secrets evaluation
- Prometheus and Grafana observability
- optional Ansible host bootstrap

## More Documentation

- [Architecture](docs/architecture.md)
- [Deployment](docs/deployment.md)
- [Migration](docs/migration.md)
- [Operations](docs/operations.md)
- [PVC Migration](docs/pvc-migration.md)
- [Platform Stabilization Report](docs/platform-stabilization-report.md)
- [Environment Drift Report](docs/environment-drift-report.md)
- [Rebuild Validation Report](docs/rebuild-validation-report.md)
- [Rollback](docs/rollback.md)
- [Runtime Validation Report](docs/runtime-validation-report.md)
- [StatefulSet Evaluation](docs/statefulset-evaluation.md)
- [Phase 3 Readiness](docs/phase-3-readiness-assessment.md)
- [Validation](docs/validation.md)
