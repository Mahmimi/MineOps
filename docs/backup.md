# MineOps Backup Foundation

## Summary

MineOps includes Kubernetes-managed automatic backups for Minecraft world data.

Backups are created by `cronjob/minecraft-backup` in the `mineops` namespace. The job is managed by Terraform and runs every 30 minutes by default.

## Schedule

Default:

```hcl
backup_schedule = "*/30 * * * *"
```

The CronJob uses `concurrencyPolicy = Forbid`, so a new backup will not start while a previous backup is still running.

## Storage

The backup pod mounts `/backups` from the k3d node.

For Windows k3d development, `infra/k3d/local.yaml` maps:

```text
${MINEOPS_BACKUP_HOST_PATH}:/backups
```

Recommended local setup:

```powershell
New-Item -ItemType Directory -Force .\backups
$env:MINEOPS_BACKUP_HOST_PATH = (Resolve-Path .\backups).Path
```

`.env` default:

```env
MINEOPS_STORAGE_PATH=.local/k3d/storage
MINEOPS_BACKUP_HOST_PATH=./backups
MINEOPS_TIME_ZONE=
```

Backup logs and timestamped backup folder names use `MINEOPS_TIME_ZONE`. When this value is empty, `mineops init` derives the host timezone.

Backup log lines use host-local `YYYY-MM-DD HH:mm:ss` format. Backup folder names keep a filename-safe host-local variant such as `backup_2026-06-27_1-22-54`.

The current cluster must be recreated with the updated k3d config before `/backups` maps to the Windows host path. Without recreation, Kubernetes still writes to `/backups` inside the existing k3d node container.

## Safe Backup Sequence

The backup job uses the Minecraft console pipe, not RCON.

Sequence:

```text
say 30 second warning
sleep 25
say 5 second warning
sleep 5
save-all
save-off
copy world/config data
save-on
say success or failure
```

Minecraft is configured with:

```hcl
CREATE_CONSOLE_IN_PIPE = true
```

The job runs `mc-send-to-console` as the `minecraft` user through `gosu`.

## Backup Contents

The backup job copies restore-oriented world and configuration files:

- `world`
- `world_nether`
- `world_the_end`
- `server.properties`
- `whitelist.json`
- `ops.json`
- `banned-ips.json`
- `banned-players.json`
- `usercache.json`

Runtime caches, logs, libraries, downloaded server jars, and plugin temp files are intentionally excluded.

## Retention Modes

### replace

Keeps one backup:

```text
/backups/latest/
```

### append

Creates timestamped folders and does not delete old backups:

```text
/backups/2026-06-23_17-00-00/
```

### append_with_limit

Creates timestamped folders and retains only the most recent `backup_limit` folders.

Default:

```hcl
backup_mode  = "append_with_limit"
backup_limit = 5
```

## Terraform Variables

```hcl
backup_enabled   = true
backup_schedule  = "*/30 * * * *"
backup_mode      = "append_with_limit"
backup_limit     = 5
backup_host_path = "./backups"
```

## Security Model

Discord remains read-only.

The backup job has its own ServiceAccount:

- can `get` and `list` pods
- can create `pods/exec` only to send console commands required for backup consistency
- cannot patch deployments
- cannot read Secrets
- has no cluster-wide permissions

The backup pod uses a root init container only to prepare `/backups` permissions. The actual backup container runs as UID 1000 to read Minecraft-owned world files.
