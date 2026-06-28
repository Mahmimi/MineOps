# Multi-Instance

MineOps is multi-instance first. One `mineops.yaml` file can define multiple isolated Minecraft platforms.

## Isolation Model

Each instance owns:

- one Kubernetes namespace
- one Minecraft deployment and PVC
- one Playit deployment
- one Discord bot deployment
- one backup CronJob
- one runtime secret/config set
- one generated Terraform workdir

Resource names stay stable inside the namespace:

- `minecraft`
- `discord-bot`
- `playit`
- `minecraft-backup`
- `minecraft-data`

Isolation comes from namespace boundaries plus instance labels.

## Example

```yaml
instances:
  survival:
    namespace: mineops-survival
    services: { ... }

  creative:
    namespace: mineops-creative
    services: { ... }
```

## Command Targeting

Safe read or broadcast commands usually support `--all`:

```powershell
mineops status --all
mineops doctor --all
mineops logs backup --all
```

Unsafe commands require an explicit target when multiple instances exist:

```powershell
mineops import --instance survival --source migrate/world
mineops restore latest --instance survival
mineops shell minecraft --instance survival
```

If multiple instances exist and you omit a target for a non-broadcast command, MineOps fails fast instead of guessing.

## Backup Layout

Per-instance backups are stored under:

```text
<globals.backupHostPath>/<instance-name>
```

For a legacy single-instance deployment, the default instance continues to use the backup root directly for compatibility.

## Why Namespaces Matter

MineOps deliberately keeps cross-instance operational blast radius low:

- Discord lifecycle commands only operate inside one namespace
- Playit readiness only checks the local instance's Minecraft service endpoints
- backup and restore operate on one PVC at a time
- generated runtime artifacts are applied per namespace

## Related

- [Commands](commands.md)
- [Storage](../architecture/storage.md)
- [Networking](../architecture/networking.md)
