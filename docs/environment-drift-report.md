# Environment Drift Report

Validation date: 2026-06-22

## Drift Items Found

| Item | Why It Existed | Resolution |
| --- | --- | --- |
| k3d kubeconfig used `host.docker.internal` and a random API port | k3d default behavior without explicit API config | Fixed with `kubeAPI.host`, `hostIP`, and `hostPort` in `infra/k3d/local.yaml` |
| `.local/kubeconfig-mineops.yaml` | Temporary workaround for Windows host access | Removed; no longer needed |
| `.local/tools/terraform` | Temporary portable Terraform binary before host Terraform was installed | Removed; host Terraform is used |
| Saved Terraform plan files | Validation artifacts | Removed from workspace |
| Manually created `playit-secret` | Playit Deployment required a Secret before Terraform managed one | Replaced with Terraform-managed placeholder Secret |
| Real Playit token in legacy Secret manifest | Historical migration artifact | Replaced with placeholder; token should be rotated |
| Pods had BestEffort QoS | Requests/limits were absent | Added requests and limits |
| PVC binding required workload creation | k3d `local-path` binds after consuming pod exists | Kept `wait_until_bound = false` |

## Items Intentionally Local

- `.local/k3d/storage`: generated host-backed k3d storage. It is ignored and required while the local cluster is running.
- Terraform state: local and ignored for V1 homelab use.
- `terraform.tfvars`: ignored local override file for non-production credentials or local settings.

## Manual Intervention Removed

- No manual kubeconfig editing.
- No manual Secret creation.
- No repo-local Terraform binary required.
- No saved plan files required for normal operation.

## Remaining Blockers

- Rotate the old Playit token that appeared in legacy files.
- Decide whether to remove the unrelated old `minecraft` k3d cluster from the local host.
