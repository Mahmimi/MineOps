# k3d Local Cluster

This directory holds the local k3d cluster definition for MineOps.

The V1 cluster is intentionally small:

- one server node
- one agent node
- fixed Kubernetes API endpoint at `https://localhost:6550`
- host port `25565` mapped for future Minecraft traffic
- host-backed local-path storage under `.local/k3d/storage`
- Traefik disabled until MineOps needs HTTP ingress

Create the cluster later with:

```bash
New-Item -ItemType Directory -Force .\.local\k3d\storage
$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
k3d cluster create --config infra/k3d/local.yaml
```

The generated kubeconfig should use:

```text
https://localhost:6550
```

No manual kubeconfig editing should be required.

Do not mount live Minecraft data directly from the legacy Compose folder. Copy from a verified backup into Kubernetes storage during the migration phase.
