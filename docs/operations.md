# MineOps Operations

## Local Cluster

The local cluster definition lives in `infra/k3d/local.yaml`.

Planned command:

```bash
k3d cluster create --config infra/k3d/local.yaml
```

The cluster maps host port `25565` for Minecraft traffic and maps `.local/k3d/storage` for persistent storage.

## Terraform

Terraform foundation files live in `infra/terraform/`.

Current checks:

```bash
terraform fmt -check -recursive infra/terraform
```

Phase 2 Terraform manages:

- `mineops` namespace
- `minecraft-data` PVC
- `minecraft` Deployment
- `minecraft` Service
- `playit` Deployment

Use `docs/deployment.md` for the full apply flow.

## Data Safety

Do not commit live Minecraft world data, backups, kubeconfig files, Terraform state, or secrets.

Do not run Kubernetes against the preserved legacy Compose data path. Migration should copy from a verified backup into Kubernetes-owned storage.

## Scale To Zero

Scale-to-zero is not implemented in Phase 2.

Future Minecraft operations may support replicas `0` and `1` only. Before scaling to zero, the platform must save and stop the server cleanly. Automatic idle shutdown should wait until player detection, backup behavior, and graceful shutdown are reliable.
