# Networking

MineOps exposes player access through Minecraft services plus Playit tunnel connectivity.

## Minecraft Services

Terraform creates:

- a primary Minecraft service
- a Minecraft Query protocol service

The query service supports read-only player visibility used by the Discord bot.

## Playit Join Path

Playit readiness is not just deployment readiness.

MineOps reports the public join path as ready only when:

- the Playit deployment is online
- the Minecraft service has at least one endpoint

This prevents false positives when the tunnel agent is up but Minecraft is stopped.

## Namespace Isolation

Each instance has its own namespace and its own Playit deployment. The Discord bot reads only within that namespace.

## Operational Implication

When `mineops playit` reports:

- agent ready
- no Minecraft endpoints

the platform is telling you the tunnel exists but the server behind it is unavailable.

## Related

- [Runtime](runtime.md)
- [Commands](../user-guide/commands.md)
