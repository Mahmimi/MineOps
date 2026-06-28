# Legacy Configuration Migration

Existing MineOps users can continue using `.env`, `config/minecraft.yaml`, and `mineops-admins.json`. The legacy adapter converts those files into a single `default` instance internally.

## Legacy To YAML Mapping

`.env` values map to global runtime values and service credentials.

`config/minecraft.yaml` maps to `instances.<name>.services.minecraft` and backup settings.

`mineops-admins.json` maps to `instances.<name>.services.discord.admins`.

## Migration Steps

1. Create `mineops.yaml` at the repository root.
2. Copy Minecraft settings from `config/minecraft.yaml` into `instances.<name>.services.minecraft`.
3. Move Discord and Playit credentials to environment variables and reference them from YAML with `${NAME}`.
4. Choose one namespace per instance, such as `mineops-survival` and `mineops-creative`.
5. Choose one backup host path per instance.
6. Run `mineops init`.

`mineops init` remains the deployment command. The CLI automatically prefers `mineops.yaml` when present and falls back to legacy files otherwise.