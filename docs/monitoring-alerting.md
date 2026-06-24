# Monitoring and Alerting

MineOps Phase 5.1 provides a lightweight monitoring and alerting foundation without installing Prometheus.

## Monitoring Layer

The monitoring layer is intentionally small and replaceable.

Current providers:

- `KubernetesMetricsProvider`
- `MetricsProvider` interface

Observed signals:

- Minecraft readiness
- Discord bot readiness
- cluster node availability
- backup Job state
- backup age
- backup duration
- player count through Minecraft Query Protocol
- PVC capacity

Operator views:

```powershell
.\mineops.ps1 status
.\mineops.ps1 metrics
.\mineops.ps1 doctor
.\mineops.ps1 dashboard
```

## Alerting Layer

Current providers:

- `DiscordAlertProvider`
- `AlertProvider` interface
- `AlertHistoryStore`

Alert, event, timeline, and maintenance state are written to a PVC mounted at:

```text
/app/data
```

The CLI reads this history through:

```powershell
.\mineops.ps1 alerts
.\mineops.ps1 events
.\mineops.ps1 timeline
```

## Discord Alert Channel

Set this optional value to deliver alerts to Discord:

```env
DISCORD_ALERT_CHANNEL_ID=
```

When the value is empty, alert evaluation and durable history still run, but Discord alert delivery is disabled.

## Current Alerts

- Minecraft offline
- Minecraft recovered
- backup failed
- backup recovered
- backup stale
- backup fresh again

## Maintenance Mode

Maintenance mode is stored under `/app/data/maintenance/state.json`.

When enabled:

- CLI status reports maintenance as `ON`
- Discord status includes maintenance context
- alert evaluation is muted

Use:

```powershell
.\mineops.ps1 maintenance on
.\mineops.ps1 maintenance off
```

## Deduplication

The bot sends or records one active alert per incident key and one recovery record when the incident clears.

Active incident state is currently in memory. Historical alert records are durable on the alert-history PVC.

## Phase 6 Readiness

Phase 6 should replace or supplement the lightweight providers with:

- Prometheus metrics queries
- Grafana dashboards
- Alertmanager notifications
- kubelet/cAdvisor PVC usage metrics
- durable active-alert state

The provider interfaces exist so this can be added without rewriting command handlers or operator UX.
