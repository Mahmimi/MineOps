import fs from 'node:fs';
import path from 'node:path';
import { UserInputError } from '../domain/errors.js';

export class ConfigService {
  constructor({ root, kubernetes, dataService, runner, getMineOpsConfig }) {
    this.root = root;
    this.kubernetes = kubernetes;
    this.dataService = dataService;
    this.runner = runner;
    this.getMineOpsConfig = getMineOpsConfig;
    this.configPath = path.join(root, 'config', 'minecraft.yaml');
  }

  mineopsConfig() {
    return this.getMineOpsConfig();
  }

  minecraftConfig() {
    return this.mineopsConfig().defaultInstance()?.legacy.minecraft ?? {};
  }

  readRaw() {
    return this.mineopsConfig().globals.raw.minecraft ?? '';
  }

  parse() {
    return this.minecraftConfig();
  }

  validate() {
    return this.parse();
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