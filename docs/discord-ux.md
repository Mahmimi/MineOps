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
- Playit public join readiness

Example fields:

```text
MineOps Online
Uptime: 2h 14m
Players: 3 / 20
Last Backup: 5 minutes ago
Version: Paper Latest
Playit: Ready for public joins
```

## `/server`

Shows:

- server type
- version
- memory
- world
- difficulty
- game mode
- public Playit join address, when `PLAYIT_JOIN_ADDRESS` is configured
- Playit health
- backup mode
- backup interval

## `/playit`

Shows the public tunnel health separately:

- Playit agent readiness
- ready and desired replicas
- Minecraft Service endpoint count
- public join address, when configured

If the Playit agent is connected but Minecraft has zero endpoints, `/playit` reports that the join path is blocked.

## `/players`

Shows online players as an embed.

When empty:

```text
Online Players (0 / 20)
No players online right now.
```

## `/dashboard`

Primary daily operations view.

Shows:

- Minecraft status
- player count
- uptime
- backup health
- Discord connectivity
- cluster reachability
- maintenance mode

## `/backups`

Shows recent completed backup Jobs, backup mode, retention, and latest backup age.

## `/events`

Shows the latest platform events from durable event history.

Examples:

```text
Backup completed
Maintenance enabled
Minecraft started
MineOps deployed
```

## `/alerts`

Shows active alerts first. If nothing is active, the embed uses an explicit empty state.

## `/help`

Shows the read-only command reference:

- `/status`
- `/server`
- `/playit`
- `/players`
- `/dashboard`
- `/backups`
- `/events`
- `/alerts`
- `/start_server`
- `/stop_server`
- `/restart_server`
- `/help`

## `/start_server`

Starts Minecraft when it is stopped.

If Minecraft is already running, MineOps returns an informational embed and performs no action.

## `/stop_server`

Stops Minecraft gracefully.

MineOps administrators only.

The command:

- checks the MineOps admin allow-list
- broadcasts a shutdown warning
- saves world data
- scales the Deployment to zero
- emits a lifecycle event

## `/restart_server`

Restarts Minecraft gracefully.

MineOps administrators only.

The command:

- checks the MineOps admin allow-list
- saves world data
- restarts the Deployment
- waits for readiness
- verifies the query endpoint responds
- emits a lifecycle event

## Embed Standards

All embeds include:

- consistent colors
- consistent icons
- timestamp
- MineOps footer
- empty-state messaging
- maintenance mode indicators where relevant

Status colors:

- green: healthy
- yellow: warning or maintenance
- red: critical/offline
- blue: informational

## Security Model

Discord is no longer purely read-only in v1.0.0. It supports constrained lifecycle operations through MineOps services.

Discord commands cannot:

- run Terraform
- run arbitrary kubectl
- exec arbitrary commands into pods
- trigger backups
- restore backups
- mutate infrastructure
- mutate resources other than the Minecraft Deployment lifecycle

Backup, restore, and world import remain CLI-only administrative operations.
