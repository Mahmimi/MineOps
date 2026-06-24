# MineOps CLI

The MineOps CLI is the operator entrypoint for local platform operations.

Use it from the repository root:

```powershell
.\mineops.ps1 init
.\mineops.ps1 deploy
.\mineops.ps1 status
```

## Commands

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
- backup CronJob

### `mineops info`

Shows version, cluster, namespace, backup mode, backup interval, and environment.

### `mineops dashboard`

Starts a simple terminal dashboard that refreshes every 10 seconds.

Use this for local operations. It has no external dependencies.

For validation without a long-running loop:

```powershell
.\mineops.ps1 dashboard --once
```

### `mineops timeline`

Shows a chronological platform activity timeline. Use `--type <backup|server|discord|system|maintenance|alert>` to filter.

### `mineops events`

Shows recent operational events from backup Jobs, Minecraft startup, alert history, and Kubernetes Events.

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

### `mineops logs <minecraft|discord|backup>`

Shows logs for common runtime components.
