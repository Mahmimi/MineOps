# Legacy To `mineops.yaml`

MineOps still supports the legacy singleton input set:

- `.env`
- `config/minecraft.yaml`
- optional `mineops-admins.json`

That path is maintained through `LegacyConfigAdapter` and is now a migration layer, not the preferred operating model.

## Legacy Mapping

- `.env` becomes global runtime and secret input
- `config/minecraft.yaml` becomes `services.minecraft`
- `mineops-admins.json` becomes `services.discord.admins`
- the old singleton deployment becomes one `default` instance

## Migration Steps

1. Create `mineops.yaml` at the repository root.
2. Move Minecraft settings into `instances.<name>.services.minecraft`.
3. Move Discord and Playit values into service blocks with `${NAME}` references.
4. Move the admin allow-list into `services.discord.admins`.
5. Choose an explicit namespace for each instance.
6. Set `globals.storagePath` and `globals.backupHostPath`.
7. Run `mineops validate`.
8. Run `mineops config graph`.
9. Run `mineops init`.

## Example Translation

Legacy:

```text
.env
config/minecraft.yaml
mineops-admins.json
```

Becomes:

```yaml
instances:
  survival:
    namespace: mineops-survival
    services:
      minecraft: ...
      discord:
        admins:
          admins: ...
      playit: ...
      backup: ...
```

## Important Change

Legacy docs often treated `.env` or `config/minecraft.yaml` as the main source of truth. In the current architecture they are not. They are only legacy adapter inputs.

## Related

- [mineops.yaml](../user-guide/mineops-yaml.md)
- [Configuration Adapters](../developer-guide/configuration-adapters.md)
