# Rebuild Validation Report

Validation date: 2026-06-22

## Procedure Executed

1. Destroyed Terraform-managed MineOps runtime resources.
2. Deleted the `mineops-local` k3d cluster.
3. Removed generated k3d storage under `.local/k3d/storage`.
4. Recreated the cluster from `infra/k3d/local.yaml`.
5. Verified kubeconfig endpoint was generated as `https://localhost:6550`.
6. Ran Terraform init, fmt, validate, plan, and apply from `infra/terraform`.
7. Ran post-apply Terraform plan.
8. Validated Kubernetes runtime resources.

## Results

| Step | Result |
| --- | --- |
| k3d cluster creation | Pass |
| kubeconfig without manual edits | Pass |
| kubeconfig server | `https://localhost:6550` |
| Nodes Ready | Pass, 1 server and 1 agent |
| Terraform init | Pass |
| Terraform fmt | Pass |
| Terraform validate | Pass |
| Terraform plan | Pass, 6 creates |
| Terraform apply | Pass |
| Post-apply plan | Pass, No changes |
| Namespace | Pass |
| PVC | Pass, Bound |
| Minecraft Deployment | Pass, `1/1` |
| Playit Deployment | Pass, `0/0` by design |
| Placeholder Secret | Pass |
| Service reachability | Pass, `127.0.0.1:25565` |

## Final Runtime State

- `deployment/minecraft`: `1/1` Running
- `deployment/playit`: `0/0` intentionally disabled for credential-free validation
- `pvc/minecraft-data`: Bound, 20Gi, RWO, `local-path`
- `service/minecraft`: LoadBalancer on TCP `25565`
- Terraform post-apply plan: No changes

## Success Criteria Assessment

- Deterministic: Pass
- Reproducible: Pass
- Idempotent: Pass
- Rebuildable from scratch: Pass
- No manual kubeconfig edits: Pass
- No manual Secret injection: Pass
- No production credentials: Pass
