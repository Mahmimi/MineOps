# Monitoring Platform

This directory is reserved for MineOps monitoring resources.

Phase 5 intentionally does not install Prometheus. Monitoring is currently provided by:

- MineOps CLI commands
- Discord bot alert loop
- Kubernetes Job and Deployment status
- backup CronJob metadata

Future Kubernetes resources can be added here when Prometheus, Grafana, exporters, or alert routing are introduced.

Recommended future layout:

```text
platform/monitoring/
├── prometheus/
├── grafana/
├── exporters/
└── alertmanager/
```
