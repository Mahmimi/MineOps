# Platform Stabilization Report

Validation date: 2026-06-22

## Summary

MineOps is now deterministic and rebuildable from source-controlled configuration.

The k3d API endpoint is fixed at `https://localhost:6550`, Terraform uses the default host kubeconfig directly, runtime resources are Terraform-managed, Playit uses a Terraform-managed placeholder Secret, and Playit is scaled to `0` replicas by default so no production credentials are required for validation.

## Stabilization Changes

- Added fixed k3d API configuration:
  - `kubeAPI.host: localhost`
  - `kubeAPI.hostIP: 127.0.0.1`
  - `kubeAPI.hostPort: 6550`
- Removed the need for repo-local edited kubeconfig.
- Added Terraform-managed placeholder `playit-secret`.
- Set default `playit_replicas = 0` for credential-free rebuilds.
- Added CPU and memory requests/limits for Minecraft and Playit.
- Replaced committed legacy Playit secret material with placeholders.
- Added Phase 3 placeholder structure:
  - `apps/discord-bot/`
  - `platform/kubernetes/backup/`
  - `platform/kubernetes/automation/`

## Deployment Model

1. Create k3d from `infra/k3d/local.yaml`.
2. Use generated kubeconfig directly from the Windows host terminal.
3. Run Terraform from `infra/terraform`.
4. Terraform manages namespace, PVC, Minecraft Deployment, Minecraft Service, placeholder Playit Secret, and Playit Deployment.
5. Playit remains disabled by default until a non-production token is supplied through local Terraform variables.

## Secret Management Approach

Current validation:

- Terraform creates a placeholder Secret.
- No real Playit or Discord tokens are needed.
- No manual Secret creation is required.

Future non-production Playit test:

- Create ignored `infra/terraform/terraform.tfvars`.
- Set `playit_replicas = 1`.
- Set `playit_secret_value` to a non-production token.

Future production-like use:

- Do not commit secrets.
- Prefer SOPS, External Secrets Operator, Sealed Secrets, or a homelab secret manager.
- Rotate any token that was ever committed to legacy files.

## Operational Workflow

Standard rebuild:

```bash
New-Item -ItemType Directory -Force .\.local\k3d\storage
$env:MINEOPS_STORAGE_PATH = (Resolve-Path .\.local\k3d\storage).Path
k3d cluster create --config infra/k3d/local.yaml
cd infra/terraform
terraform init
terraform validate
terraform plan
terraform apply
```

Expected default result:

- Minecraft: `1/1` Running
- Playit: `0/0` by design
- PVC: Bound
- Service: reachable on `localhost:25565`
- Terraform plan after apply: No changes

## Remaining Notes

- Local Terraform state is still local and ignored. That is acceptable for homelab V1, but a remote backend can be evaluated later.
- The separate old `minecraft` k3d cluster still exists on this machine in a stopped/partial state and is unrelated to MineOps reproducibility.
