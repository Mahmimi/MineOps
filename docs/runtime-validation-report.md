# Runtime Validation Report

Validation date: 2026-06-22

Scope: MineOps runtime foundation after platform stabilization.

## Summary

Result: Go for Phase 3 planning.

Minecraft runs successfully on the rebuilt `mineops-local` k3d cluster. The namespace, PVC, Deployment, Service, logs, resource requests/limits, TCP connectivity, and Terraform idempotency were validated. Legacy world data was not copied or modified.

Playit is intentionally disabled by default with `0` replicas and a Terraform-managed placeholder Secret so clean-room validation does not require real credentials.

## Environment

- Docker: available, server version `27.1.1`
- k3d: available
- kubectl: available
- Terraform: host-installed, version `1.15.6`
- Active validation cluster: `k3d-mineops-local`
- Kubernetes API endpoint: `https://localhost:6550`
- Nodes:
  - `k3d-mineops-local-server-0`: Ready
  - `k3d-mineops-local-agent-0`: Ready

## Terraform Validation

- `terraform init`: passed
- Kubernetes provider selected from lock file: `hashicorp/kubernetes v3.2.0`
- `terraform fmt -check -recursive`: passed
- `terraform validate`: passed
- `terraform plan`: passed
- `terraform apply`: passed
- Post-apply drift check: passed, no changes

## Runtime Validation

| Check | Result | Notes |
| --- | --- | --- |
| Namespace | Pass | `mineops` exists and is labeled as Terraform-managed |
| PVC | Pass | `minecraft-data` is Bound, 20Gi, RWO, `local-path` |
| Minecraft Deployment | Pass | `1/1` Ready |
| Minecraft Pod | Pass | Running, Ready, 0 restarts |
| Minecraft `/data` mount | Pass | `/data` mounted read-write from `minecraft-data` PVC |
| Minecraft logs | Pass | Server starts successfully |
| Playit Deployment | Pass | `0/0` by design |
| Playit Secret | Pass | Terraform-managed placeholder Secret |
| Minecraft Service | Pass | `LoadBalancer`, port `25565` |
| Local TCP connectivity | Pass | `127.0.0.1:25565` reachable |
| Terraform drift | Pass | No changes after apply |
| Resource requests/limits | Pass | Minecraft and Playit resources are defined |

## Issues Resolved

1. k3d storage path used a relative host path.
   - Resolution: `infra/k3d/local.yaml` uses `${MINEOPS_STORAGE_PATH}` and docs set it to an absolute path.

2. k3d-generated kubeconfig used an unreliable host endpoint.
   - Resolution: k3d config now pins `kubeAPI.host=localhost`, `hostIP=127.0.0.1`, and `hostPort=6550`.

3. Terraform PVC waited for binding before Minecraft Deployment existed.
   - Resolution: PVC uses `wait_until_bound = false` for k3d `local-path`.

4. Runtime validation depended on a real Playit token.
   - Resolution: Terraform manages a placeholder Secret and Playit defaults to `0` replicas.

5. Pods had BestEffort QoS.
   - Resolution: CPU and memory requests/limits were added.

## Current Requests And Limits

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
| --- | ---: | ---: | ---: | ---: |
| Minecraft | `1000m` | `3000m` | `5Gi` | `6Gi` |
| Playit | `50m` | `250m` | `64Mi` | `256Mi` |

## Go / No-Go Recommendation

Recommendation: Go for Phase 3 planning and non-production implementation.

Do not migrate the real legacy world yet. First implement and validate backup/restore mechanics against disposable test data.
