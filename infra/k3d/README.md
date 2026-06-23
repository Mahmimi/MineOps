# k3d Local Cluster

This directory holds the local k3d cluster definition for MineOps.

The V1 cluster is intentionally small:

- one server node
- one agent node
- fixed Kubernetes API endpoint at `https://localhost:6550`
- host port `25565` mapped for future Minecraft traffic
- host-backed local-path storage under `.local/k3d/storage`
- host-backed backup storage under repository root `.\backups`
- Traefik disabled until MineOps needs HTTP ingress

Create the cluster later with:

```bash
New-Item -ItemType Directory -Force .\.local\k3d\storage
New-Item -ItemType Directory -Force .\backups
$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
$env:MINEOPS_BACKUP_HOST_PATH = (Resolve-Path .\backups).Path
k3d cluster create --config infra/k3d/local.yaml
```

If using `.env`, set:

```env
MINEOPS_STORAGE_PATH=.local/k3d/storage
MINEOPS_BACKUP_HOST_PATH=./backups
```

Then load it before cluster creation:

```powershell
$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
$env:MINEOPS_BACKUP_HOST_PATH = (Resolve-Path .\backups).Path
```

The generated kubeconfig should use:

```text
https://localhost:6550
```

No manual kubeconfig editing should be required.

Do not commit live Minecraft data or backup contents. Keep world data in Kubernetes storage and host backups under `./backups`.
