# MineOps Multi-Instance Platform Architecture

MineOps now treats configuration as a platform domain model rather than as deployment-time file discovery.

```text
Configuration Adapter
  legacy files | mineops.yaml | generated config | tests | future API
        |
        v
Environment Resolution
        |
        v
Fail-fast Validation
        |
        v
Immutable MineOpsConfig
        |
        v
Deployment Planning
        |
        v
Generated Artifacts
  terraform.tfvars.json | runtime-config.json | Kubernetes manifests
        |
        v
Stateless Infrastructure Executors
  Terraform | bootstrap scripts | kubectl | health checks
```

## Domain Model

`MineOpsConfig` is the canonical desired state for the platform. It is not a YAML DTO and deployment components must not know which adapter produced it.

Core shape:

```text
MineOpsConfig
  cluster
  globals
  instances[]
    InstanceConfig
      name
      namespace
      services[]
```

Every instance owns its namespace, Secrets, ConfigMaps, PVCs, Minecraft server, Playit agent, Discord bot, backup CronJob, runtime configuration, labels, and generated Terraform state.

## Configuration Sources

Adapters are input boundaries. The legacy adapter reads `.env`, `config/minecraft.yaml`, and `mineops-admins.json`. The YAML adapter reads `mineops.yaml`. Both produce the same validated immutable `MineOpsConfig`.

No deployment component should read legacy configuration files directly.

## Instance Isolation

Instance resources use the same in-namespace resource names for compatibility and operational simplicity, but namespaces, PersistentVolumes, backup paths, labels, generated Terraform workdirs, runtime artifacts, and manifests are instance-specific.

Label contract:

```text
app.kubernetes.io/part-of=mineops
app.kubernetes.io/instance=<instance-name>
app.kubernetes.io/name=<service-name>
app.kubernetes.io/component=<component>
```

## Artifact-First Infrastructure

Infrastructure executors are stateless consumers. Terraform receives generated `terraform.tfvars.json`; runtime bootstrap receives generated runtime JSON; Kubernetes receives generated or static manifests. Executors should not discover configuration by reading `.env`, `minecraft.yaml`, `mineops-admins.json`, or `mineops.yaml`.

## Service Extension Points

Current services are Minecraft, Discord, Playit, and Backup. New services should own their validation, defaults, Terraform/runtime inputs, Kubernetes manifests, generated Secrets/ConfigMaps, and health checks behind a descriptor boundary. The orchestrator should continue to iterate instances and services rather than adding service-specific control flow.