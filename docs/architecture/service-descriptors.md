# Service Descriptors

MineOps is service-oriented even though the current implementation does not yet expose a single `ServiceRegistry` class.

## Current Descriptor Boundary

A platform service is currently represented by:

- a typed `PlatformServiceConfig` entry on an instance
- validation rules in the schema
- artifact generation logic where needed
- runtime naming through `resourceNamesFor`
- operational behavior in CLI and bot services

Current service types:

- `minecraft`
- `discord`
- `playit`
- `backup`

## Why This Boundary Exists

New services should not require rewriting the whole deployment pipeline. The orchestrator should continue to iterate instances and feed explicit configuration into generators and executors.

## What A New Service Typically Needs

1. schema and defaults
2. adapter mapping
3. domain config presence on `InstanceConfig.services`
4. generated Terraform, runtime, or manifest inputs
5. operational status and logs support
6. documentation

## Current Limitation

The platform already behaves like it has service descriptors, but the logic is still distributed across adapters, generators, and services instead of being centralized in a formal registry object.

That is implementation reality, not a documentation omission.

## Related

- [Adding A Service](../developer-guide/adding-a-service.md)
- [Deployment Planner](../developer-guide/deployment-planner.md)
