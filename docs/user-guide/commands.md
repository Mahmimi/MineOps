# Commands

MineOps commands are instance-aware. The CLI resolves targets from `--instance`, `--all`, or the single configured instance.

## Targeting Rules

- If exactly one instance exists, commands can default to it.
- If multiple instances exist, MineOps requires `--instance` or `--all` where appropriate.
- Unsafe commands such as `restore`, `import`, and `shell` require `--instance`.

## Core Commands

### Deploy And Validate

```powershell
mineops init
mineops validate
mineops config validate --all
mineops doctor --all
```

### Status And Logs

```powershell
mineops status --all
mineops health --all
mineops info --all
mineops logs minecraft --instance survival
mineops logs backup --all
mineops playit --instance survival
```

### Configuration Inspection

```powershell
mineops config show
mineops config show --instance survival
mineops config diff --instance survival
mineops config graph
```

`config show` without target flags prints the raw configuration source. With `--instance`, it prints a normalized instance summary.

### Routine Operations

```powershell
mineops backup --instance survival
mineops backups --instance survival
mineops backups latest --instance survival
mineops maintenance on --instance survival Planned restart
mineops maintenance off --instance survival
```

### Lifecycle

```powershell
mineops start minecraft --instance survival
mineops stop minecraft --instance survival
mineops restart minecraft --instance survival
mineops shell minecraft --instance survival
```

Stopping Minecraft also suspends the backup CronJob. Starting it resumes the CronJob after rollout.

### Migration And Recovery

```powershell
mineops import --instance survival --source migrate/world
mineops restore latest --instance survival
mineops update minecraft 1.21.1 --instance survival
```

`mineops update minecraft` creates a backup before changing the configured version and patching the running deployment.

## Full Command Surface

Current CLI commands:

- `alerts`
- `backup`
- `backups`
- `cluster`
- `config`
- `dashboard`
- `doctor`
- `events`
- `health`
- `help`
- `import`
- `info`
- `init`
- `logs`
- `maintenance`
- `metrics`
- `playit`
- `restart`
- `restore`
- `shell`
- `start`
- `status`
- `stop`
- `timeline`
- `update`
- `validate`
- `version`

Use:

```powershell
mineops help
mineops <command> --help
```

## Related

- [Day-2 Operations](../operator-guide/day-2-operations.md)
- [Backup And Restore](../operator-guide/backup-and-restore.md)
