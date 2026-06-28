# Adding A Service

MineOps is designed to grow by adding platform services without breaking the SSOT-to-artifact flow.

## Current Extension Path

Add a service by extending these layers:

1. schema
2. adapter mapping
3. domain service config presence
4. artifact generation
5. runtime execution or manifest application
6. operator surfaces such as status, logs, and health

## Practical Steps

### 1. Extend The Schema

Add a new discriminated service schema in `apps/mineops-cli/src/config/schema/mineops-config-schema.js`.

### 2. Extend Adapters

Map the external config shape into `InstanceConfig.services` in:

- `MineOpsYamlAdapter`
- `LegacyConfigAdapter` if legacy compatibility is required

### 3. Decide The Execution Model

Choose whether the service is driven by:

- Terraform
- runtime secret/config artifacts
- generated manifests
- some combination of the above

### 4. Add Operational Support

Update the CLI and, if relevant, the Discord bot so the service can participate in:

- status
- health
- logs
- troubleshooting

## Guardrails

- Do not let infrastructure read new config files directly.
- Do not bypass schema validation with ad hoc runtime defaults.
- Do not couple new services to singleton assumptions.

## Related

- [Service Descriptors](../architecture/service-descriptors.md)
- [Project Structure](project-structure.md)
