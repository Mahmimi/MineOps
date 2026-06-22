# MineOps Operations

V1 operations are focused on repository hygiene and safe migration preparation.

## Local Cluster

The local cluster definition lives in `infra/k3d/local.yaml`.

Planned command:

```bash
k3d cluster create --config infra/k3d/local.yaml
```

The cluster maps host port `25565` for future Minecraft traffic and maps `.local/k3d/storage` for future persistent storage.

## Terraform

Terraform foundation files live in `infra/terraform/`.

Current checks:

```bash
terraform fmt -check -recursive infra/terraform
```

No Minecraft, Playit, storage, Discord bot, or controller resources are implemented yet.

## Data Safety

Do not commit live Minecraft world data, backups, kubeconfig files, Terraform state, or secrets.

Do not run Kubernetes against the preserved legacy Compose data path. Future migration should copy from a verified backup into Kubernetes-owned storage.

## Scale To Zero

Future Minecraft operations should support replicas `0` and `1` only.

Before scaling to zero, the platform must save and stop the server cleanly. Automatic idle shutdown should wait until player detection, backup behavior, and graceful shutdown are reliable.
