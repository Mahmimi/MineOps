# Operations

## Check Platform Status

```powershell
kubectl get pods -n mineops
kubectl get svc -n mineops
kubectl get cronjob -n mineops
```

## Minecraft Logs

```powershell
kubectl logs -n mineops deployment/minecraft
```

## Discord Bot Logs

```powershell
kubectl logs -n mineops deployment/discord-bot
```

## Backup Jobs

List recent backup jobs:

```powershell
kubectl get jobs -n mineops
```

Create a manual backup from the CronJob:

```powershell
kubectl create job -n mineops mineops-backup-manual --from=cronjob/minecraft-backup
kubectl wait -n mineops --for=condition=complete job/mineops-backup-manual --timeout=300s
kubectl logs -n mineops job/mineops-backup-manual
```

## Runtime Secrets

Create or update runtime Secrets from `.env`:

```powershell
.\scripts\bootstrap-secrets.ps1
```

Delete runtime Secrets:

```powershell
.\scripts\delete-secrets.ps1
```

After deleting Secrets, affected pods may fail until the Secrets are restored.

## Terraform

```powershell
cd infra\terraform
terraform fmt
terraform validate
terraform plan
terraform apply
```

## Data Safety

Do not commit:

- `.env`
- Terraform state
- kubeconfig files
- Minecraft world data
- backup contents
- Discord or Playit tokens

Backups are stored under repository root `./backups`, but backup contents are ignored by Git.
