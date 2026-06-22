# Platform Kubernetes

This directory contains plain Kubernetes manifests for the MineOps runtime foundation.

Terraform is the preferred apply path for Phase 2. These manifests exist as readable references, examples, and an escape hatch for manual inspection.

## Components

- `namespace.yaml` creates the `mineops` namespace.
- `storage/pvc.yaml` declares the Minecraft data PVC.
- `minecraft/deployment.yaml` runs `itzg/minecraft-server` with replicas set to `1`.
- `minecraft/service.yaml` exposes Minecraft TCP traffic on port `25565`.
- `playit/deployment.yaml` defines `ghcr.io/playit-cloud/playit-agent:0.17` with replicas set to `0` for credential-free validation.
- `playit/secret.example.yaml` shows the placeholder Secret shape without committing real values.
- `backup/` is reserved for future backup scheduler resources.
- `automation/` is reserved for future platform automation resources.

## Ownership

Objects are labeled with `app.kubernetes.io/managed-by: terraform` because Terraform manages the active resources.

Do not apply both Terraform and raw manifests to the same cluster unless you are intentionally recovering from Terraform state loss.

Terraform is responsible for creating the active placeholder Secret. Use real Playit tokens only through ignored local overrides or a future secret-management integration.
