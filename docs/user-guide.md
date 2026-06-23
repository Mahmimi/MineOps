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

## Discord Commands

### `/status`

Shows a friendly server dashboard:

- online/offline state
- uptime
- players online
- Minecraft version
- game mode

### `/players`

Shows:

- online player count
- maximum player count
- player names when players are online

### `/server`

Shows general server information and the join-address note.

## Backup Warnings

MineOps runs automatic backups every 30 minutes by default.

Players will see messages before backup starts:

```text
[MineOps] Automatic backup will start in 30 seconds. A short lag spike may occur during backup.
[MineOps] Backup starting in 5 seconds...
```

When the backup finishes, players will see a success or failure message.

## What The Discord Bot Cannot Do

The bot is read-only.

It cannot:

- start the server
- stop the server
- restart the server
- run Minecraft commands
- run Terraform
- run kubectl
- trigger backups manually
- change infrastructure
