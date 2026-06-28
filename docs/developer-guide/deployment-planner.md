# Deployment Planner

MineOps does not yet have a standalone `DeploymentPlanner` class. Planning is currently implemented as a generation pipeline around immutable config.

## Current Planning Stages

1. load and validate `MineOpsConfig`
2. resolve one or more `InstanceConfig` objects
3. generate Terraform variables per instance
4. generate runtime artifacts per instance
5. generate Discord manifests per instance
6. execute Terraform, bootstrap, and `kubectl` against those artifacts

## Where Planning Lives Today

- `generateTerraformVars`
- `generateRuntimeArtifact`
- `generateDiscordManifest`
- `DeploymentManager`
- `EnvironmentManager`

## Why This Still Counts As Planning

The important architectural property is separation:

- desired state is computed first
- infrastructure execution consumes explicit outputs
- commands do not mix raw YAML parsing into executor logic

## Current Debt

Planning is distributed rather than explicit. A future dedicated planner or service registry could centralize:

- service iteration
- artifact ownership
- change detection semantics
- extension hooks for new platform services

Documentation should describe the current distributed planner, not a future abstraction that does not exist yet.

## Related

- [Service Descriptors](../architecture/service-descriptors.md)
- [Adding A Service](adding-a-service.md)
