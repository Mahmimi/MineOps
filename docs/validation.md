# Validation Checklist

Use this checklist after applying the Phase 2 Terraform resources.

## Cluster

- `kubectl get nodes` shows the k3d cluster nodes as Ready.
- `kubectl get namespace mineops` succeeds.

## Storage

- `kubectl get pvc -n mineops minecraft-data` shows Bound.
- PVC storage size matches the Terraform variable.
- No Kubernetes workload is mounted directly to the legacy Compose data path.

## Minecraft

- `kubectl get deploy -n mineops minecraft` shows `1/1` ready.
- `kubectl get pods -n mineops -l app.kubernetes.io/name=minecraft` shows one running pod.
- `kubectl logs -n mineops deploy/minecraft` shows the server started successfully.
- Minecraft listens on TCP port `25565`.
- Only one Minecraft pod exists.

## Playit

- `kubectl get deploy -n mineops playit` shows `1/1` ready.
- `kubectl logs -n mineops deploy/playit` does not show missing secret errors.
- `playit-secret` exists in the `mineops` namespace.

## Service

- `kubectl get svc -n mineops minecraft` shows a `LoadBalancer` Service.
- Players can connect through the expected local or Playit endpoint after tunnel configuration is valid.

## Terraform

- `terraform fmt -check -recursive infra/terraform` passes.
- `terraform validate` passes from `infra/terraform`.
- `terraform plan` shows no unexpected drift after apply.

## Phase Boundaries

- No Discord bot exists.
- No MineOps controller exists.
- No scale-to-zero automation exists.
- Legacy world data and backups remain preserved.

## Runtime Validation Result

The 2026-06-22 runtime validation report is available at `docs/runtime-validation-report.md`.

Current status:

- Namespace: pass
- PVC: pass
- Minecraft pod: pass
- Playit Deployment: pass, intentionally `0` replicas for credential-free validation
- Service connectivity: pass
- Terraform drift: pass
- Resource requests/limits: pass
