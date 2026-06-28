import fs from 'node:fs';
import path from 'node:path';
import { ConfigAdapter } from './config-adapter.js';
import { withLegacyEnvDefaults } from '../resolution/legacy-env.js';

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed.replace(/^"|"$/g, '');
}

function parseSimpleYaml(raw) {
  const root = {};
  let current = null;
  let currentNested = null;

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;

    const section = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (section) {
      current = section[1];
      root[current] = root[current] ?? {};
      currentNested = null;
      continue;
    }

    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && current) {
      if (!Array.isArray(root[current])) root[current] = [];
      root[current].push(parseScalar(listItem[1]));
      currentNested = current;
      continue;
    }

    const nestedSection = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
    if (nestedSection && current) {
      root[current][nestedSection[1]] = {};
      currentNested = nestedSection[1];
      continue;
    }

    const keyValue = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (keyValue && current) {
      root[current][keyValue[1]] = parseScalar(keyValue[2]);
      continue;
    }

    const deepKeyValue = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (deepKeyValue && current && currentNested) {
      root[current][currentNested][deepKeyValue[1]] = parseScalar(deepKeyValue[2]);
    }
  }

  return root;
}

function parseDotEnv(raw) {
  const values = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const index = trimmed.indexOf('=');
    if (index < 1) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}

function readOptional(pathname) {
  if (!fs.existsSync(pathname)) return { exists: false, raw: null };
  return { exists: true, raw: fs.readFileSync(pathname, 'utf8') };
}

export class LegacyConfigAdapter extends ConfigAdapter {
  constructor({ root, namespace = 'mineops', clusterName = 'mineops-local', envPath = null }) {
    super({ source: 'legacy' });
    this.root = root;
    this.namespace = namespace;
    this.clusterName = clusterName;
    this.envPath = envPath ? path.resolve(root, envPath) : path.join(root, '.env');
  }

  loadRaw() {
    const envPath = this.envPath;
    const minecraftPath = path.join(this.root, 'config', 'minecraft.yaml');
    const adminsPath = path.join(this.root, 'mineops-admins.json');

    const envFile = readOptional(envPath);
    const minecraftFile = readOptional(minecraftPath);
    const adminsFile = readOptional(adminsPath);

    const env = withLegacyEnvDefaults(envFile.exists ? parseDotEnv(envFile.raw) : {}, { root: this.root });
    const minecraftYaml = minecraftFile.exists ? parseSimpleYaml(minecraftFile.raw) : {};

    return {
      source: this.source,
      files: {
        env: { path: envPath, exists: envFile.exists },
        minecraft: { path: minecraftPath, exists: minecraftFile.exists },
        admins: { path: adminsPath, exists: adminsFile.exists },
      },
      cluster: {
        name: this.clusterName,
      },
      env,
      raw: {
        env: envFile.raw,
        minecraft: minecraftFile.raw,
        admins: adminsFile.raw,
      },
      instances: [
        {
          name: 'default',
          namespace: this.namespace,
          services: [
            {
              type: 'minecraft',
              config: minecraftYaml,
            },
            {
              type: 'discord',
              config: {
                token: env.DISCORD_TOKEN,
                clientId: env.DISCORD_CLIENT_ID,
                guildId: env.DISCORD_GUILD_ID,
                alertChannelId: env.DISCORD_ALERT_CHANNEL_ID ?? '',
                adminsFile: {
                  path: adminsPath,
                  exists: adminsFile.exists,
                  raw: adminsFile.raw,
                },
              },
            },
            {
              type: 'playit',
              config: {
                secretKey: env.PLAYIT_SECRET_KEY,
                joinAddress: env.PLAYIT_JOIN_ADDRESS ?? '',
              },
            },
            {
              type: 'backup',
              config: {
                hostPath: env.MINEOPS_BACKUP_HOST_PATH,
                settings: minecraftYaml.backup ?? {},
              },
            },
          ],
          legacy: {
            env,
            minecraft: minecraftYaml,
            files: {
              env: envPath,
              minecraft: minecraftPath,
              admins: adminsPath,
            },
          },
        },
      ],
    };
  }
}

