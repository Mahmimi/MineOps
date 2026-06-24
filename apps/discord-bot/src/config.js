const PLACEHOLDER_TOKEN = 'replace-with-discord-bot-token';

function boolFromEnv(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function intFromEnv(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

function pathFromEnv(value, defaultValue) {
  return value === undefined || value === '' ? defaultValue : value;
}

export function loadConfig(env = process.env) {
  const discordToken = env.DISCORD_TOKEN ?? '';

  return {
    serviceName: env.SERVICE_NAME ?? 'mineops-discord-bot',
    logLevel: env.LOG_LEVEL ?? 'info',
    httpPort: intFromEnv(env.HTTP_PORT, 8080),
    discord: {
      token: discordToken,
      tokenPlaceholder: PLACEHOLDER_TOKEN,
      clientId: env.DISCORD_CLIENT_ID ?? '',
      guildId: env.DISCORD_GUILD_ID ?? '',
      alertChannelId: env.DISCORD_ALERT_CHANNEL_ID ?? '',
      registerCommands: boolFromEnv(env.DISCORD_REGISTER_COMMANDS, true),
      required: boolFromEnv(env.DISCORD_REQUIRED, false),
      enabled: discordToken !== '' && discordToken !== PLACEHOLDER_TOKEN,
    },
    mineops: {
      namespace: env.MINEOPS_NAMESPACE ?? 'mineops',
      minecraftDeploymentName: env.MINECRAFT_DEPLOYMENT_NAME ?? 'minecraft',
      minecraftServiceName: env.MINECRAFT_SERVICE_NAME ?? 'minecraft',
      minecraftLabelSelector: env.MINECRAFT_LABEL_SELECTOR ?? 'app.kubernetes.io/name=minecraft',
      minecraftContainerName: env.MINECRAFT_CONTAINER_NAME ?? 'minecraft',
      playitDeploymentName: env.PLAYIT_DEPLOYMENT_NAME ?? 'playit',
      playitLabelSelector: env.PLAYIT_LABEL_SELECTOR ?? 'app.kubernetes.io/name=playit',
      playitJoinAddress: env.PLAYIT_JOIN_ADDRESS ?? '',
      backupCronJobName: env.BACKUP_CRONJOB_NAME ?? 'minecraft-backup',
      backupLabelSelector: env.BACKUP_LABEL_SELECTOR ?? 'app.kubernetes.io/name=minecraft-backup',
      adminConfigPath: pathFromEnv(env.MINEOPS_ADMIN_CONFIG_PATH, '/app/config/mineops-admins.json'),
    },
    minecraft: {
      queryHost: env.MINECRAFT_QUERY_HOST ?? 'minecraft-query',
      queryPort: intFromEnv(env.MINECRAFT_QUERY_PORT, 25565),
      queryTimeoutMs: intFromEnv(env.MINECRAFT_QUERY_TIMEOUT_MS, 2000),
    },
    monitoring: {
      enabled: boolFromEnv(env.MONITORING_ENABLED, true),
      intervalMs: intFromEnv(env.MONITORING_INTERVAL_MS, 60000),
      pvcUsageWarningPercent: intFromEnv(env.PVC_USAGE_WARNING_PERCENT, 80),
    },
    lifecycle: {
      idleShutdownEnabled: boolFromEnv(env.IDLE_SHUTDOWN_ENABLED, true),
      idleShutdownMinutes: intFromEnv(env.IDLE_SHUTDOWN_MINUTES, 30),
      intervalMs: intFromEnv(env.LIFECYCLE_INTERVAL_MS, 60000),
      operationTimeoutMs: intFromEnv(env.LIFECYCLE_OPERATION_TIMEOUT_MS, 600000),
      readinessTimeoutMs: intFromEnv(env.LIFECYCLE_READINESS_TIMEOUT_MS, 180000),
    },
  };
}

