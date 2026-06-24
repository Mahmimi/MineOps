# User Guide

This guide is for Minecraft players and Discord users.

## Joining The Server

Use the Playit address configured for your MineOps server.

The Discord `/server` command also shows:

- server type
- version
- memory
- game mode
- difficulty
- world name
- join address guidance
- Playit tunnel health

## Discord Commands

### `/status`

Shows a friendly server dashboard:

- online/offline state
- uptime
- players online
- Minecraft version
- game mode
- Playit public join readiness

### `/players`

Shows:

- online player count
- maximum player count
- player names when players are online

### `/server`

Shows general server information and the join-address note.

### `/playit`

Shows whether the Playit tunnel is ready for public joins.

If it says the agent is ready but Minecraft has no endpoints, the server is stopped or not ready yet.

## Backup Warnings

MineOps runs automatic backups every 30 minutes by default.

Players will see messages before backup starts:

```text
[MineOps] Automatic backup will start in 30 seconds. A short lag spike may occur during backup.
[MineOps] Backup starting in 5 seconds...
```

When the backup finishes, players will see a success or failure message.

## What The Discord Bot Can And Cannot Do

Anyone can use `/start_server` to bring Minecraft online.

Only MineOps admins can use `/stop_server` and `/restart_server`.

It cannot:

- run Minecraft commands
- run Terraform
- run kubectl
- trigger backups manually
- restore backups
- change infrastructure
