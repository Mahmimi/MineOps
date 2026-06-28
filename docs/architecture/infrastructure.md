# Infrastructure

MineOps infrastructure is split between generated Terraform inputs, runtime artifact application, and generated manifests.

## Terraform

Terraform manages the core per-instance runtime:

- namespace
- Minecraft persistent volume and claim
- Minecraft deployment and services
- Playit secret placeholder and deployment
- backup service account, role, binding, config map, and CronJob

MineOps writes a generated `terraform.tfvars.json` for each instance and applies Terraform from an instance-specific workdir under `.mineops/terraform/<instance>`.

## Runtime Artifact Application

Runtime secrets and config maps are generated as JSON artifacts and applied through `scripts/bootstrap-secrets.ps1`.

That script:

- creates or updates Kubernetes Secrets from literal values
- creates or updates ConfigMaps from generated files
- applies MineOps labels

This is why `bootstrap-secrets.ps1` is not the configuration source. It is an executor for already-generated artifacts.

## Generated Manifests

The Discord bot manifest is generated per instance because it depends on namespace, labels, and runtime wiring.

MineOps applies it from `.mineops/manifests/<instance>/discord-bot.yaml`.

## Deterministic Execution

Infrastructure receives explicit inputs derived from `MineOpsConfig`:

- Terraform gets generated vars
- runtime bootstrap gets generated JSON
- `kubectl apply` gets generated manifest YAML

That keeps execution deterministic and reduces drift caused by hidden file reads.

## Related

- [Deployment Pipeline](deployment-pipeline.md)
- [Runtime](runtime.md)
