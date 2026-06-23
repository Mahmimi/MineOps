# Platform Kubernetes

This directory contains Kubernetes manifests for MineOps platform components.

Terraform is the source of truth for the main runtime resources under `infra/terraform`.

## Components

- `namespace.yaml` creates the `mineops` namespace.
- `storage/pvc.yaml` declares the Minecraft data PVC.
- `minecraft/` contains reference Minecraft manifests.
- `playit/` contains Playit reference manifests and Secret example shape.
- `discord-bot/` contains the read-only Discord bot manifests.
- `backup/` documents the Terraform-managed backup resources.

## Ownership

Use Terraform for the main platform runtime:

```powershell
cd infra\terraform
terraform apply
```

Use the Discord bot manifests after building/importing the local bot image:

```powershell
kubectl apply -f platform\kubernetes\discord-bot --recursive
```

Do not commit real Discord or Playit tokens.
