# Secrets

MineOps uses a local `.env` file for developer credentials and Kubernetes Secrets for runtime injection.

Real secrets must never be committed to Git.

## Required Values

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
PLAYIT_SECRET_KEY=
PLAYIT_JOIN_ADDRESS=
MINEOPS_STORAGE_PATH=.local/k3d/storage
MINEOPS_BACKUP_HOST_PATH=./backups
MINEOPS_TIME_ZONE=
```

`PLAYIT_JOIN_ADDRESS` is not a secret; it lets the CLI/docs-facing bot responses show the public address players should use.

`MINEOPS_TIME_ZONE` is not a secret. It controls human-facing MineOps timestamps in runtime containers. Leave it empty when using `mineops init`; the CLI injects the host timezone.

## Local Workflow

Create `.env`:

```powershell
Copy-Item .env.example .env
notepad .env
```

Validate it:

```powershell
.\scripts\validate-env.ps1
```

Create or update Kubernetes Secrets:

```powershell
.\scripts\bootstrap-secrets.ps1
```

The bootstrap script creates:

- `discord-bot-secret`
- `playit-secret`

It is idempotent and does not print secret values.

## Cleanup

```powershell
.\scripts\delete-secrets.ps1
```

This removes MineOps runtime Secrets from the `mineops` namespace.

## Secret Manifests

Secret examples use `.yaml.example`:

```text
platform/kubernetes/discord-bot/secret.yaml.example
platform/kubernetes/playit/secret.yaml.example
```

They are shape references only and should not contain real values.

## Terraform Boundary

Terraform owns the runtime resource definitions, but real Discord and Playit credentials are injected locally through Kubernetes Secrets.

This avoids committing credentials and keeps sensitive values out of normal source files.
