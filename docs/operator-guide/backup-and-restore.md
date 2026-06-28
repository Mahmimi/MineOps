# Backup And Restore

MineOps separates routine backup from deliberate recovery.

## Backup Model

Backups are created by a Kubernetes CronJob named `minecraft-backup` inside each instance namespace.

The backup workflow:

1. warns players in chat
2. runs `save-all`
3. disables writes with `save-off`
4. copies restore-oriented files
5. reenables writes with `save-on`
6. reports success or failure

The backup job uses the Minecraft console pipe, not RCON.

## Backup Storage

Backups live on the host under the instance backup root:

```text
<globals.backupHostPath>/<instance-name>
```

For the legacy default instance, MineOps keeps using the backup root directly for compatibility.

## Manual Backup

```powershell
mineops backup --instance survival
mineops backups --instance survival
mineops backups latest --instance survival
```

`mineops backup` creates a one-off Job from the backup CronJob and waits for completion.

## Retention Modes

- `replace`: one backup directory
- `append`: timestamped backups; if `limit` is set, MineOps keeps only the newest `limit` folders
- `append_with_limit`: legacy alias for capped timestamped backups

## Backup Contents

MineOps backs up restore-oriented files:

- `world`
- `world_nether`
- `world_the_end`
- `server.properties`
- `whitelist.json`
- `ops.json`
- `banned-ips.json`
- `banned-players.json`
- `usercache.json`

Because the full `world` directory is copied, player state is included as part of the backup. That covers standard layouts such as:

- `world/playerdata`, `world/advancements`, and `world/stats`
- `world/players/data`, `world/players/advancements`, and `world/players/stats`

It intentionally excludes runtime caches, logs, downloaded jars, and temporary files.

## Restore

Restore is manual and instance-scoped:

```powershell
mineops restore latest --instance survival
mineops restore backup_2026-06-27_1-30-36 --instance survival
```

The CLI delegates to `scripts/restore.ps1`, which:

1. resolves and validates the backup
2. scales Minecraft to zero
3. waits for pod deletion
4. creates a temporary restore helper pod
5. replaces restore-oriented files in the PVC, including player state stored under the world directory
6. scales Minecraft back to one
7. waits for rollout and verifies the restored world

Restore is not exposed through Discord.

## Import

Import is for bringing external world data into an instance PVC:

```powershell
mineops import --instance survival --source migrate/world
mineops import --instance survival --source migrate/server-data --world-only
```

The import workflow stops Minecraft, mounts the PVC in a temporary pod, streams files with `tar`, repairs ownership, restarts Minecraft, and verifies `level.dat`.

Import is blocked when backup activity is in progress.

## Related

- [Storage](../architecture/storage.md)
- [Troubleshooting](troubleshooting.md)
- [Legacy To mineops.yaml](../migration/legacy-to-mineops-yaml.md)
