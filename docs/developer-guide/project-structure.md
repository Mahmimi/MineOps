# Project Structure

The codebase is organized around platform boundaries rather than around one deployment script.

## Main Directories

```text
apps/
  mineops-cli/
    src/
      application/      target resolution
      commands/         CLI presentation layer
      config/           adapters, schema, generators
      domain/           immutable config and domain errors
      infrastructure/   process and Kubernetes adapters
      services/         orchestration and platform workflows
      ui/               terminal formatting
  discord-bot/
    src/
      discord/          slash command definitions and embeds
      platform/         lifecycle, alerts, status, query, persistence
infra/
  k3d/                  cluster definition
  terraform/            per-instance infrastructure templates
platform/
  kubernetes/           static and reference manifests
scripts/                restore and runtime bootstrap executors
```

## CLI Responsibilities

- load configuration
- resolve instance targets
- orchestrate deployment and day-2 operations
- provide operator-facing output

Commands should stay thin. Business logic belongs in services and infrastructure adapters.

## Discord Bot Responsibilities

- read namespace-scoped platform state
- show status, events, alerts, and player information
- guard lifecycle actions with auth and locks

## Cross-Cutting Rules

- configuration files are read only by adapters
- domain config is immutable
- infrastructure executes from generated artifacts
- services should operate against `InstanceConfig`

## Related

- [Configuration Adapters](configuration-adapters.md)
- [Deployment Planner](deployment-planner.md)
