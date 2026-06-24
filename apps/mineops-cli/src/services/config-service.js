import fs from 'node:fs';
import path from 'node:path';
import { UserInputError } from '../domain/errors.js';

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^\d+$/.test(trimmed)) return Number.parseInt(trimmed, 10);
  return trimmed.replace(/^"|"$/g, '');
}

export class ConfigService {
  constructor({ root, kubernetes, dataService, runner }) {
    this.root = root;
    this.kubernetes = kubernetes;
    this.dataService = dataService;
    this.runner = runner;
    this.configPath = path.join(root, 'config', 'minecraft.yaml');
  }

  readRaw() {
    return fs.readFileSync(this.configPath, 'utf8');
  }

  parse() {
    const root = {};
    let current = null;
    let currentList = null;
    for (const line of this.readRaw().split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const section = line.match(/^([A-Za-z0-9_-]+):\s*$/);
      if (section) {
        current = section[1];
        root[current] = root[current] ?? {};
        currentList = null;
        continue;
      }
      const listItem = line.match(/^\s+-\s+(.+)$/);
      if (listItem && current) {
        if (!Array.isArray(root[current])) root[current] = [];
        root[current].push(parseScalar(listItem[1]));
        currentList = current;
        continue;
      }
      const nestedSection = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*$/);
      if (nestedSection && current) {
        root[current][nestedSection[1]] = {};
        currentList = nestedSection[1];
        continue;
      }
      const keyValue = line.match(/^\s{2}([A-Za-z0-9_-]+):\s*(.*)$/);
      if (keyValue && current) {
        root[current][keyValue[1]] = parseScalar(keyValue[2]);
        continue;
      }
      const deepKeyValue = line.match(/^\s{4}([A-Za-z0-9_-]+):\s*(.*)$/);
      if (deepKeyValue && current && currentList) {
        root[current][currentList][deepKeyValue[1]] = parseScalar(deepKeyValue[2]);
      }
    }
    return root;
  }

  validate() {
    const config = this.parse();
    const required = [
      ['minecraft.type', config.minecraft?.type],
      ['minecraft.version', config.minecraft?.version],
      ['world.difficulty', config.world?.difficulty],
      ['world.mode', config.world?.mode],
      ['server.memory', config.server?.memory],
      ['server.maxPlayers', config.server?.maxPlayers],
      ['backup.enabled', config.backup?.enabled],
      ['backup.interval', config.backup?.interval],
      ['backup.mode', config.backup?.mode],
    ];
    const missing = required.filter(([, value]) => value === undefined || value === '').map(([key]) => key);
    if (missing.length > 0) throw new UserInputError(`Missing required config values: ${missing.join(', ')}`, { usage: 'mineops validate' });
    if (!['replace', 'append', 'append_with_limit'].includes(config.backup.mode)) {
      throw new UserInputError('backup.mode must be replace, append, or append_with_limit', { usage: 'mineops validate' });
    }
    return config;
  }

  setMinecraftVersion(version) {
    if (!/^(LATEST|\d+(\.\d+){1,2})$/i.test(version)) {
      throw new UserInputError('Invalid Minecraft version', { usage: 'mineops update minecraft <version>', examples: ['mineops update minecraft LATEST', 'mineops update minecraft 1.21.1'] });
    }
    const raw = this.readRaw();
    const next = raw.replace(/(^minecraft:\r?\n\s+type:\s*.*\r?\n\s+version:\s*).*/m, `$1${version}`);
    fs.writeFileSync(this.configPath, next, 'utf8');
  }

  runtimeDiff() {
    const config = this.parse();
    const deploy = this.kubernetes.getDeployment('minecraft');
    const env = deploy?.spec?.template?.spec?.containers?.[0]?.env ?? [];
    const value = (name) => env.find((item) => item.name === name)?.value;
    return [
      ['minecraft.version', config.minecraft?.version, value('VERSION')],
      ['minecraft.type', config.minecraft?.type, value('TYPE')],
      ['server.memory', config.server?.memory, value('MEMORY')],
      ['server.maxPlayers', String(config.server?.maxPlayers), value('MAX_PLAYERS')],
      ['world.seed', String(config.world?.seed), value('SEED')],
      ['world.difficulty', config.world?.difficulty, value('DIFFICULTY')],
      ['world.mode', config.world?.mode, value('MODE')],
    ].map(([key, desired, actual]) => ({ key, desired, actual, drift: desired !== actual }));
  }

  worldMetadataWarnings() {
    const config = this.parse();
    const result = this.runner.run('kubectl', ['exec', '-n', 'mineops', 'deployment/minecraft', '--', 'sh', '-lc', 'test -f /data/world/level.dat && echo level.dat-present; test -f /data/server.properties && grep -E "^(level-seed|difficulty|gamemode)=" /data/server.properties || true'], { capture: true, allowFailure: true });
    if (result.status !== 0) return ['Minecraft world metadata is not readable yet.'];
    const warnings = [];
    if (!result.stdout.includes('level.dat-present')) warnings.push('world/level.dat was not found in the running world.');
    const properties = Object.fromEntries(result.stdout.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => line.split('=')));
    if (properties['difficulty'] && properties['difficulty'] !== config.world?.difficulty) warnings.push(`world difficulty differs from config: ${properties.difficulty} != ${config.world.difficulty}`);
    if (properties['gamemode'] && properties['gamemode'] !== config.world?.mode) warnings.push(`world mode differs from config: ${properties.gamemode} != ${config.world.mode}`);
    return warnings;
  }
}
