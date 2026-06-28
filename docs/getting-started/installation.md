# Installation

MineOps runs on a host with Docker, `k3d`, `kubectl`, Terraform, Node.js, and PowerShell available in `PATH`.

## Host Requirements

- Docker Desktop
- `k3d`
- `kubectl`
- Terraform
- Node.js 20 or newer
- PowerShell

MineOps validates these requirements during `mineops init`.

## Verify The Toolchain

```powershell
docker ps
k3d version
kubectl version --client
terraform version
node --version
powershell -Version
```

If any command is missing, fix that before continuing.

## Clone The Repository

```powershell
git clone https://github.com/Mahmimi/MineOps
cd MineOps
```

## Prepare Configuration

MineOps prefers `mineops.yaml`. Secrets stay outside the file and are referenced through `${NAME}` placeholders.

Use the repository root:

- `mineops.yaml` for platform configuration
- optional `.env` for local environment-variable loading

See [mineops.yaml](../user-guide/mineops-yaml.md) for the full format.

## First Validation

Run:

```powershell
mineops validate
mineops config graph
```

This confirms the configuration loads, validates, and resolves into one or more instances before any infrastructure changes happen.

Next: [Quick Start](quick-start.md)
