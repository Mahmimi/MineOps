import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'yaml';
import { ConfigAdapter } from './config-adapter.js';
import { withLegacyEnvDefaults } from '../resolution/legacy-env.js';

function resolveEnvRefs(value, env = process.env) {
  if (typeof value === 'string') {
    return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => env[name] ?? '');
  }
  if (Array.isArray(value)) return value.map((item) => resolveEnvRefs(item, env));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, resolveEnvRefs(nested, env)]));
  }
  return value;
}

function minecraftConfig(service = {}) {
  return {
    minecraft: {
      type: service.type ?? 'PAPER',
      version: String(service.version ?? 'LATEST'),
    },
    world: {
      seed: service.world?.seed ?? service.seed ?? '5063885805507972583',
      difficulty: service.world?.difficulty ?? 'normal',
      mode: service.world?.mode ?? 'survival',
    },
    server: {
      memory: service.server?.memory ?? service.memory ?? '4G',
      onlineMode: service.server?.onlineMode ?? true,
      maxPlayers: service.server?.maxPlayers ?? 20,
    },
    operators: service.operators ?? [],
    backup: service.backup ?? { enabled: true, interval: '*/30 * * * *', mode: 'append', limit: 5 },
    storage: service.storage ?? { size: '20Gi' },
    resources: service.resources ?? {
      requests: { cpu: '1000m', memory: '5Gi' },
      limits: { cpu: '3000m', memory: '6Gi' },
    },
  };
}

export class MineOpsYamlAdapter extends ConfigAdapter {
  constructor({ root, configPath = path.join(root, 'mineops.yaml') }) {
    super({ source: 'mineops.yaml' });
    this.root = root;
    this.configPath = configPath;
  }

  detect() {
    return fs.existsSync(this.configPath);
  }

  loadRaw() {
    const rawYaml = fs.readFileSync(this.configPath, 'utf8');
    const doc = resolveEnvRefs(parse(rawYaml) ?? {});
    const globalEnv = withLegacyEnvDefaults({
      MINEOPS_TIME_ZONE: doc.globals?.timezone,
      MINEOPS_BACKUP_HOST_PATH: doc.globals?.backupHostPath,
      MINEOPS_STORAGE_PATH: doc.globals?.storagePath,
    }, { root: this.root });

    const instances = Object.entries(doc.instances ?? {}).map(([name, instance]) => {
      const services = instance.services ?? {};
      const minecraft = minecraftConfig(services.minecraft ?? {});
      const discord = services.discord ?? {};
      const playit = services.playit ?? {};
      const backup = services.backup ?? minecraft.backup;
      const backupSettings = { enabled: backup.enabled ?? true, interval: backup.interval ?? '*/30 * * * *', mode: backup.mode ?? 'append', limit: backup.limit ?? 5 };
      return {
        name,
        namespace: instance.namespace,
        labels: instance.labels ?? {},
        services: [
          { type: 'minecraft', config: { ...minecraft, backup: backupSettings } },
          {
            type: 'discord',
            config: {
              token: discord.token,
              clientId: discord.clientId,
              guildId: discord.guildId,
              alertChannelId: discord.alertChannelId ?? '',
              adminsFile: { path: `${this.configPath}#instances.${name}.services.discord.admins`, exists: true, raw: JSON.stringify(discord.admins ?? { admins: [] }) },
            },
          },
          { type: 'playit', config: { secretKey: playit.secretKey, joinAddress: playit.joinAddress ?? '' } },
          { type: 'backup', config: { hostPath: backup.hostPath, settings: backupSettings } },
        ],
      };
    });

    const env = {
      ...globalEnv,
      DISCORD_TOKEN: instances[0]?.services.find((service) => service.type === 'discord')?.config.token ?? '',
      DISCORD_CLIENT_ID: instances[0]?.services.find((service) => service.type === 'discord')?.config.clientId ?? '',
      DISCORD_GUILD_ID: instances[0]?.services.find((service) => service.type === 'discord')?.config.guildId ?? '',
      PLAYIT_SECRET_KEY: instances[0]?.services.find((service) => service.type === 'playit')?.config.secretKey ?? '',
    };

    return {
      source: this.source,
      files: {
        env: { path: this.configPath, exists: true },
        minecraft: { path: this.configPath, exists: true },
        admins: { path: this.configPath, exists: true },
      },
      cluster: { name: doc.cluster?.name ?? 'mineops-local' },
      env,
      raw: { env: rawYaml, minecraft: rawYaml, admins: rawYaml },
      instances,
    };
  }
}