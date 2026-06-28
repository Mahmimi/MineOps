# Day-2 Operations

This guide covers normal platform operation after the first deployment.

## Health Checks

Use these commands in order:

```powershell
mineops status --all
mineops doctor --all
mineops health --all
mineops info --all
```

They answer different questions:

- `status`: user-facing runtime summary
- `doctor`: diagnostic checks including Terraform drift and PVC binding
- `health`: concise health matrix
- `info`: discovery details such as Kubernetes context and backup mode

## Logs

```powershell
mineops logs minecraft --instance survival
mineops logs discord --instance survival
mineops logs playit --instance survival
mineops logs backup --all
```

The backup target reads logs from backup jobs by label, not from a deployment.

## Dashboards And Event History

```powershell
mineops dashboard --instance survival
mineops dashboard --once --instance survival
mineops timeline --all
mineops events --type backup
mineops alerts --instance survival
mineops alerts --history --instance survival
```

## Maintenance Windows

```powershell
mineops maintenance on --instance survival Scheduled maintenance
mineops maintenance off --instance survival
```

Maintenance mode updates the stored platform state so alerts are muted and status surfaces show maintenance explicitly.

## Lifecycle Operations

```powershell
mineops stop minecraft --instance survival
mineops start minecraft --instance survival
mineops restart minecraft --instance survival
```

MineOps only exposes Minecraft lifecycle operations through the CLI and Discord bot. It does not provide arbitrary workload lifecycle control.

## Cluster Operations

```powershell
mineops cluster status
mineops cluster delete
mineops cluster recreate
```

`cluster recreate` is destructive to the cluster but not to host-backed storage paths you keep on disk. Run `mineops init` after recreation.

## Related

- [Backup And Restore](backup-and-restore.md)
- [Troubleshooting](troubleshooting.md)
