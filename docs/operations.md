# Operations

## Check Platform Status

```powershell
kubectl get pods -n mineops
kubectl get svc -n mineops
kubectl get cronjob -n mineops
```

## Check Playit Public Join Path

Use MineOps first:

```powershell
.\mineops.ps1 playit
.\mineops.ps1 status
.\mineops.ps1 doctor
```

Then verify Kubernetes directly:

```powershell
kubectl get deploy playit minecraft -n mineops
kubectl get svc,endpoints minecraft minecraft-query -n mineops
kubectl logs -n mineops deployment/playit --tail=120
```

If Playit logs say the tunnel is running but `endpoints/minecraft` is `<none>`, Minecraft Launcher cannot ping or connect through the Playit address because the tunnel has no Minecraft pod behind the Service.

Common fix:

```powershell
.\mineops.ps1 start minecraft
.\mineops.ps1 playit
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

## Restore

Validate the latest backup:

```powershell
.\scripts\validate-backup.ps1 latest
```

Restore the latest backup:

```powershell
.\scripts\restore.ps1 latest
```

Restore a specific backup:

```powershell
.\scripts\restore.ps1 2026-06-23_18-30-00
```

Restore is manual and intentionally not available through Discord.

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
