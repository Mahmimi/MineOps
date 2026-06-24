# MineOps CLI

The MineOps CLI is the operator entrypoint for local platform operations.

Use it from the repository root:

```powershell
.\mineops.ps1 init
.\mineops.ps1 deploy
.\mineops.ps1 status
```

## Commands

The CLI uses a command registry under `apps/mineops-cli/src/commands`.
Each command owns its metadata, usage, examples, and `execute()` function.

Global help:

```powershell
.\mineops.ps1 help
.\mineops.ps1 logs --help
```

### `mineops init`

Runs the setup wizard:

- validates local tools
- validates `.env`
- prepares host storage folders
- applies secrets when the cluster namespace exists
- tells the operator whether the platform is ready to deploy

### `mineops deploy`

Runs the deployment workflow:

1. Build Discord bot image.
2. Import image into k3d.
3. Run Terraform init/apply.
4. Bootstrap secrets.
5. Apply Kubernetes app manifests.
6. Wait for Discord bot rollout.

### `mineops status`

Shows platform health in a human-oriented format.

Includes the Playit agent and Minecraft Service endpoints because the public join address depends on both.

If Playit is connected but Minecraft is stopped, status reports the join path as degraded.

### `mineops playit`

Shows public tunnel health:

- Playit Deployment readiness
- Playit replica count
- Minecraft Service endpoint count
- whether the public join path can reach a Minecraft pod

Use this when the Playit dashboard says the tunnel is online but Minecraft Launcher cannot ping or connect.

### `mineops metrics`

Shows lightweight operational metrics:

- players
- backup age
- backup duration
- server uptime
- PVC capacity

Exact PVC used bytes are deferred to Prometheus/kubelet metrics.

### `mineops doctor`

Runs diagnostics for:

- cluster reachability
- Terraform state
- Minecraft Deployment
- PVC binding
- Discord bot
- Playit agent
- Playit join path through the Minecraft Service
- backup CronJob

### `mineops health`

Shows a fast platform health summary without the full doctor checks.

### `mineops info`

Shows version, cluster, namespace, backup mode, backup interval, and environment.

### `mineops dashboard`

Starts a simple terminal dashboard that refreshes every 10 seconds.

Use this for local operations. It has no external dependencies.

For validation without a long-running loop:

```powershell
.\mineops.ps1 dashboard --once
```

### `mineops version`

Shows MineOps version metadata, Git commit, and build date.

### `mineops timeline`

Shows a chronological platform activity timeline.

Supported filters:

```powershell
.\mineops.ps1 timeline --type backup
.\mineops.ps1 timeline --type minecraft
.\mineops.ps1 timeline --type maintenance
```

### `mineops events`

Alias for the timeline view.

### `mineops backups`

Lists available backups with size, age, and status.

### `mineops backups latest`

Shows details for the latest backup only.

### `mineops alerts`

Shows recent durable alert records stored by the Discord bot under its alert-history PVC.

### `mineops alerts --history`

Shows alert history with resolved/unresolved state.

### `mineops maintenance on`

Enables maintenance mode. Alerts are muted and status reflects maintenance.

### `mineops maintenance off`

Disables maintenance mode and resumes normal alert evaluation.

### `mineops backup`

Creates and waits for a manual backup Job.

### `mineops restore <latest|timestamp>`

Runs the manual restore workflow.

Restore remains outside Discord by design.

### `mineops import world <path>`

Imports existing Minecraft world data into the `minecraft-data` PVC.

Minecraft must be stopped first:

```powershell
.\mineops.ps1 stop minecraft
.\mineops.ps1 import world "D:\minecraft-server\data"
.\mineops.ps1 start minecraft
```

The import command creates a temporary migration pod, copies data into the PVC, validates `world/level.dat`, emits a timeline event, and removes the migration pod.

### `mineops logs <minecraft|discord|playit|backup>`

Shows logs for common runtime components.

Running `mineops logs` without a target shows available targets and usage.

### `mineops restart minecraft`

Restarts the Minecraft Deployment and waits for rollout.

Terraform ignores the runtime-only `kubectl.kubernetes.io/restartedAt` annotation so operator restarts do not create Terraform drift.

### `mineops stop minecraft`

Scales Minecraft to zero replicas and waits for pod termination.

### `mineops start minecraft`

Scales Minecraft back to one replica and waits for readiness.

## Discord Lifecycle Configuration

MineOps Discord admin operations use a local allow-list:

```powershell
Copy-Item mineops-admins.json.example mineops-admins.json
.\mineops.ps1 init
.\mineops.ps1 deploy
```

`mineops-admins.json` is ignored by Git.

## Error Handling

Expected operator mistakes are shown as guided usage, not stack traces.

Example:

```text
Invalid maintenance command

Usage:
mineops maintenance on|off
```
