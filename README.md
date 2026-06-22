# MineOps

MineOps is a ChatOps-driven Minecraft platform for a local Kubernetes homelab.

The project is migrating from a legacy Docker Compose deployment into a cleaner Platform Engineering repository layout built around Docker, k3d, Kubernetes, Terraform, and future Discord-driven operations.

## Current Status

MineOps V1 is currently a repository foundation and migration-safety phase.

Implemented:

- legacy Docker Compose assets preserved under `legacy/docker-compose/`
- existing Minecraft world data preserved in place
- existing backups preserved in place
- k3d local cluster configuration skeleton
- Terraform skeleton
- platform Kubernetes directory structure
- initial documentation
- GitHub Actions foundations for Terraform format checks and markdown lint placeholder

Not implemented yet:

- Minecraft Kubernetes workload
- Playit Kubernetes workload
- Discord bot
- MineOps controller
- automated backup or restore jobs
- deployment pipeline

## Repository Layout

```text
MineOps/
|-- .github/
|   `-- workflows/              # CI foundations
|-- docs/                       # architecture, migration, and operations docs
|-- infra/
|   |-- k3d/                    # local Kubernetes cluster configuration
|   `-- terraform/              # Terraform foundation
|-- legacy/
|   |-- docker-compose/         # preserved legacy Compose deployment
|   `-- kubernetes/             # archived early Kubernetes manifests
|-- platform/
|   |-- kubernetes/             # future Kubernetes resources
|   |-- helm/                   # future Helm charts or values
|   `-- manifests/              # future raw/shared manifests
|-- .gitignore
|-- LICENSE
`-- README.md
```

## Folder Responsibilities

`legacy/` keeps the original deployment history and data source safe during migration. The current Minecraft world and backups live here and should not be modified casually.

`infra/k3d/` defines the local development Kubernetes cluster. The V1 config maps Minecraft port `25565` and prepares host-backed storage for future persistent volumes.

`infra/terraform/` contains the Terraform foundation. It currently defines provider configuration, variables, outputs, and placeholders only. Minecraft and Playit resources will be added later.

`platform/kubernetes/` is prepared for future Kubernetes resources grouped by component:

- `minecraft/`
- `playit/`
- `storage/`

`platform/helm/` and `platform/manifests/` are reserved for future packaging and shared manifest work.

`docs/` contains the project architecture, migration notes, and operational guidance.

`.github/workflows/` contains CI foundations. No deployment pipeline exists yet.

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

## Local Cluster

The k3d cluster config lives at:

```text
infra/k3d/local.yaml
```

Planned create command:

```bash
k3d cluster create --config infra/k3d/local.yaml
```

The config is prepared for local development with:

- one server node
- one agent node
- host port `25565` mapped for future Minecraft traffic
- host-backed local-path storage under `.local/k3d/storage`

## Terraform

Terraform foundation lives at:

```text
infra/terraform/
```

Current intended check:

```bash
terraform fmt -check -recursive infra/terraform
```

Terraform state, plans, and local provider caches are ignored by Git.

## Kubernetes Strategy

Minecraft should run as a single-writer workload with replicas constrained to `0` or `1`.

A future StatefulSet is the preferred default because Minecraft has stateful storage and benefits from stable identity. A Deployment can also work if replicas are strictly limited and the persistent volume is mounted by only one pod. The hard rule is that only one Minecraft server process may write to the world data at a time.

## Scale To Zero

MineOps is designed to support scale-to-zero operations in the future.

The safe future flow is:

1. Detect or request shutdown.
2. Save the Minecraft world.
3. Stop the server cleanly.
4. Scale the workload to `0`.
5. Start it again through an explicit operation or future ChatOps command.

Automatic idle shutdown should wait until player detection, backup behavior, and graceful shutdown are reliable.

## Future Expansion

Planned future areas:

- Minecraft Kubernetes workload
- Playit tunnel deployment
- persistent storage and backup jobs
- Discord bot for ChatOps
- MineOps controller with narrow Kubernetes RBAC
- Prometheus and Grafana observability
- optional Ansible host bootstrap
- CI checks for Terraform, Kubernetes manifests, Helm, and docs

## More Documentation

- [Architecture](docs/architecture.md)
- [Migration](docs/migration.md)
- [Operations](docs/operations.md)
