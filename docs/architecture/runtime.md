# Runtime

MineOps runtime behavior is provided by Kubernetes workloads plus operator services in the CLI and Discord bot.

## Runtime Components Per Instance

- `minecraft` deployment
- `playit` deployment
- `discord-bot` deployment
- `minecraft-backup` CronJob
- `minecraft-data` PVC
- runtime ConfigMaps and Secrets

## Runtime Configuration

Generated runtime config currently includes:

- timezone and timezone offset
- Playit join address
- idle shutdown settings
- Discord token, client ID, guild ID, and alert channel ID
- optional MineOps admin allow-list

## Discord Bot Runtime

The Discord bot is namespace-scoped. It:

- reads deployment, pod, service, endpoint, backup job, and CronJob state
- queries player information through the Minecraft Query protocol
- exposes read-only status and alert commands
- permits guarded Minecraft lifecycle actions

It does not:

- run Terraform
- expose arbitrary `kubectl`
- expose arbitrary Minecraft commands
- trigger restore

## Event And Alert State

MineOps persists Discord-bot operational state to the `alert-history` PVC, including:

- alert history
- event history
- maintenance state
- lifecycle lock state

## Runtime Health

Current platform health checks treat an instance as healthy when:

- Minecraft is online
- Playit public path is ready
- Discord bot is online
- backup CronJob exists

## Related

- [Networking](networking.md)
- [Storage](storage.md)
