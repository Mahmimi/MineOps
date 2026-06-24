# Phase 5.1 Validation Report

## Scope

Phase 5.1 validates platform UX, operator commands, Discord embeds, durable alert history, and future observability extension points.

## Commands To Validate

```powershell
.\mineops.ps1 init
.\mineops.ps1 deploy
.\mineops.ps1 status
.\mineops.ps1 metrics
.\mineops.ps1 dashboard --once
.\mineops.ps1 timeline
.\mineops.ps1 backups
.\mineops.ps1 backups latest
.\mineops.ps1 doctor
.\mineops.ps1 alerts
.\mineops.ps1 alerts --history
.\mineops.ps1 events
.\mineops.ps1 events --type backup
.\mineops.ps1 maintenance on
.\mineops.ps1 maintenance off
terraform plan
```

## Expected CLI Examples

```text
------------------------------
 MineOps Platform Status
------------------------------

Minecraft
Running
Uptime: 2h 12m

Discord Bot
Connected

Backups
Healthy

Cluster
Ready

------------------------------
Overall Health: HEALTHY
------------------------------
```

```text
Running Platform Diagnostics...

[OK] Cluster Reachable
[OK] Terraform State Healthy
[OK] Minecraft Deployment Healthy
[OK] PVC Bound
[OK] Discord Bot Connected
[OK] Backup CronJob Healthy

Result:
No issues found
```

## Discord UX

Discord slash commands now return embeds for:

- `/status`
- `/server`
- `/players`

The bot remains read-only.

## Known Constraint

PVC used bytes remain a Phase 6 item. MineOps reports PVC capacity now; accurate used percentage should come from Prometheus/kubelet metrics.

## Phase 6 Recommendation

Proceed to Prometheus, Grafana, Alertmanager, durable active alert state, and storage usage metrics.
