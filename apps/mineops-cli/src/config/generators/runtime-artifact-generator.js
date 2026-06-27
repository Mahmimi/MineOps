function required(value, name) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing runtime artifact value: ${name}`);
  }
  return String(value);
}

function serviceConfig(instance, type) {
  return instance.service(type)?.config ?? {};
}

function labels(instance, component) {
  return {
    'app.kubernetes.io/part-of': 'mineops',
    'app.kubernetes.io/managed-by': 'runtime-artifact',
    'app.kubernetes.io/instance': instance.name,
    'app.kubernetes.io/component': component,
  };
}

export function generateRuntimeArtifact(mineopsConfig, instance = mineopsConfig.defaultInstance()) {
  const env = mineopsConfig.globals.env;
  const discord = serviceConfig(instance, 'discord');
  const playit = serviceConfig(instance, 'playit');
  const admins = discord.adminsFile?.raw ?? null;

  const configMaps = [
    {
      name: 'mineops-runtime-config',
      labels: labels(instance, 'runtime-config'),
      data: {
        PLAYIT_JOIN_ADDRESS: playit.joinAddress ?? env.PLAYIT_JOIN_ADDRESS ?? '',
        MINEOPS_TIME_ZONE: required(env.MINEOPS_TIME_ZONE, 'MINEOPS_TIME_ZONE'),
        MINEOPS_TIME_OFFSET_SECONDS: required(env.MINEOPS_TIME_OFFSET_SECONDS, 'MINEOPS_TIME_OFFSET_SECONDS'),
        IDLE_SHUTDOWN_ENABLED: env.IDLE_SHUTDOWN_ENABLED ?? 'true',
        IDLE_SHUTDOWN_MINUTES: env.IDLE_SHUTDOWN_MINUTES ?? '30',
      },
    },
  ];

  if (admins !== null && admins !== undefined) {
    configMaps.push({
      name: 'mineops-admins',
      labels: labels(instance, 'admin-config'),
      data: {
        'mineops-admins.json': admins,
      },
    });
  }

  return {
    apiVersion: 'mineops.runtime/v1',
    namespace: instance.namespace,
    instance: instance.name,
    secrets: [
      {
        name: 'discord-bot-secret',
        labels: labels(instance, 'chatops'),
        data: {
          token: required(discord.token ?? env.DISCORD_TOKEN, 'DISCORD_TOKEN'),
          'client-id': required(discord.clientId ?? env.DISCORD_CLIENT_ID, 'DISCORD_CLIENT_ID'),
          'guild-id': required(discord.guildId ?? env.DISCORD_GUILD_ID, 'DISCORD_GUILD_ID'),
          'alert-channel-id': discord.alertChannelId ?? env.DISCORD_ALERT_CHANNEL_ID ?? '',
        },
      },
      {
        name: 'playit-secret',
        labels: labels(instance, 'tunnel'),
        data: {
          'secret-key': required(playit.secretKey ?? env.PLAYIT_SECRET_KEY, 'PLAYIT_SECRET_KEY'),
        },
      },
    ],
    configMaps,
  };
}