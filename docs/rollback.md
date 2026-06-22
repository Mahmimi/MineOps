# Rollback Procedure

Rollback for Phase 2 means returning to the preserved legacy Docker Compose deployment if the Kubernetes runtime is not ready.

## Safety Rules

- Do not delete `legacy/docker-compose/minecraft-localhost/data`.
- Do not delete `legacy/docker-compose/minecraft-localhost/data-backup`.
- Do not copy Kubernetes data back into legacy data unless you have a verified backup and a deliberate restore plan.

## Roll Back Runtime Resources

From the Terraform directory:

```bash
cd infra/terraform
terraform plan -destroy
terraform destroy
```

This removes the namespace, Minecraft PVC, Minecraft Deployment, Minecraft Service, and Playit Deployment managed by Terraform.

If Terraform is unavailable and this is a local recovery, inspect before deleting:

```bash
kubectl get all,pvc,secrets -n mineops
```

Then remove only Phase 2 resources you intentionally created.

## Restart Legacy Compose

From the preserved legacy directory:

```bash
cd legacy/docker-compose/minecraft-localhost
docker compose up -d
```

Validate:

```bash
docker compose ps
docker compose logs minecraft
```

## Rollback Checklist

- Legacy data directory still exists.
- Legacy backups still exist.
- Kubernetes Minecraft pod is stopped or removed.
- Only one Minecraft server is running.
- Players can connect through the expected legacy endpoint.
