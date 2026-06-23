# Backup Kubernetes Resources

Minecraft backup resources are managed by Terraform.

Source of truth:

```text
infra/terraform/backup.tf
```

Managed resources:

- `serviceaccount/minecraft-backup`
- `role/minecraft-backup`
- `rolebinding/minecraft-backup`
- `configmap/minecraft-backup`
- `cronjob/minecraft-backup`

Do not apply hand-written backup manifests over the Terraform-managed objects unless intentionally recovering from Terraform state loss.
