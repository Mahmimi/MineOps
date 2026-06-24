# Discord UX

MineOps Discord commands are read-only and player-oriented.

Commands use Discord embeds rather than raw text walls.

## `/status`

Shows:

- server online/offline state
- uptime
- players
- last backup age
- Minecraft version

Example fields:

```text
MineOps Online
Uptime: 2h 14m
Players: 3 / 20
Last Backup: 5 minutes ago
Version: Paper Latest
```

## `/server`

Shows:

- server type
- version
- memory
- world
- difficulty
- game mode
- backup mode
- backup interval

## `/players`

Shows online players as an embed.

When empty:

```text
Online Players (0 / 20)
No players online right now.
```

## Security Model

Discord remains read-only.

Discord commands cannot:

- run Terraform
- run kubectl
- exec into pods
- trigger backups
- restore backups
- restart Minecraft
- mutate infrastructure
- mutate Minecraft state

Operational actions remain in the MineOps CLI.
