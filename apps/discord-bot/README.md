# MineOps Discord Bot

This service is the read-only Discord ChatOps integration for MineOps.

The bot does not implement infrastructure mutation. It reads Minecraft status from the Kubernetes API through a minimal ServiceAccount and reads player information through the Minecraft Query Protocol.

## Commands

- `/status`: Minecraft running state, namespace, pod status, and uptime.
- `/players`: online count and player names from the read-only Minecraft Query Protocol.
- `/server`: Minecraft version/configuration and service endpoint.

## Environment

| Variable | Default | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | empty | Bot token loaded from a Kubernetes Secret |
| `DISCORD_CLIENT_ID` | empty | Discord application client ID used for command registration |
| `DISCORD_GUILD_ID` | empty | Optional guild ID for faster development command registration |
| `DISCORD_REGISTER_COMMANDS` | `true` | Register slash commands on startup when token and client ID are present |
| `DISCORD_REQUIRED` | `false` | If `true`, readiness requires a live Discord connection |
| `HTTP_PORT` | `8080` | Health/readiness server port |
| `MINEOPS_NAMESPACE` | `mineops` | Namespace to read |
| `MINECRAFT_DEPLOYMENT_NAME` | `minecraft` | Minecraft Deployment name |
| `MINECRAFT_SERVICE_NAME` | `minecraft` | Minecraft Service name |
| `MINECRAFT_LABEL_SELECTOR` | `app.kubernetes.io/name=minecraft` | Pod selector |
| `MINECRAFT_QUERY_HOST` | `minecraft-query` | Internal Minecraft Query Service host |
| `MINECRAFT_QUERY_PORT` | `25565` | Minecraft Query UDP port |
| `MINECRAFT_QUERY_TIMEOUT_MS` | `2000` | Query timeout in milliseconds |

## Local Checks

```bash
npm install
npm run check
npm start
```

The bot uses in-cluster Kubernetes auth when running in Kubernetes and falls back to local kubeconfig for development.
