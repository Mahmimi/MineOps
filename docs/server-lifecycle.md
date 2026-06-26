# Server Lifecycle

MineOps v1.0.0 supports controlled Minecraft lifecycle operations from Discord and the CLI.

## Discord Commands

Available commands:

- `/start_server`
- `/stop_server`
- `/restart_server`

`/start_server` is available to everyone.

`/stop_server` and `/restart_server` require the MineOps administrator allow-list.

Discord guild permissions and channel permissions are not trusted by MineOps.

## Admin Allow-List

Copy the example file:

```powershell
Copy-Item mineops-admins.json.example mineops-admins.json
```

Edit `mineops-admins.json`:

```json
{
  "admins": [
    {
      "username": "Mahmimi",
      "discordUserId": "12345"
    }
  ]
}
```

Then run:

```powershell
.\mineops.ps1 init
```

The file is ignored by Git and is converted into the `mineops-admins` ConfigMap.

## Lifecycle Safety

MineOps protects lifecycle operations with a persisted operation lock stored on the Discord bot PVC.

Lifecycle states:

- `STARTING`
- `RUNNING`
- `STOPPING`
- `STOPPED`
- `RESTARTING`
- `BACKING_UP`
- `RESTORING`

Operations are blocked when another lifecycle operation is active or a backup job is running.

## Stop Sequence

`/stop_server`:

1. Checks admin authorization.
2. Checks operation safety.
3. Broadcasts shutdown warning.
4. Runs `save-all`.
5. Scales Minecraft to zero.
6. Waits for stop completion.
7. Emits a lifecycle event.

## Restart Sequence

`/restart_server`:

1. Checks admin authorization.
2. Checks operation safety.
3. Broadcasts restart warning.
4. Runs `save-all`.
5. Runs `save-off`.
6. Restarts the Deployment.
7. Waits for readiness.
8. Verifies Minecraft Query responds.
9. Emits a lifecycle event.

## Auto Scale-To-Zero

Idle shutdown is enabled by default.

Configuration in `.env`:

```text
IDLE_SHUTDOWN_ENABLED=true
IDLE_SHUTDOWN_MINUTES=30
```

When player count remains zero for the configured idle window, MineOps stops Minecraft automatically.

Auto shutdown is skipped when:

- maintenance mode is enabled
- a backup is running
- a lifecycle operation is active
- Minecraft is already stopped

Events emitted:

- `Idle Timeout Started`
- `Idle Timeout Cancelled`
- `Auto Shutdown Triggered`
