import fs from 'node:fs';
import { parse, stringify } from 'yaml';
import { UserInputError } from '../domain/errors.js';
import { resourceNamesFor } from '../domain/resource-names.js';

function minecraftConfigFor(instance) {
  return instance?.service('minecraft')?.config ?? {};
}

export class ConfigService {
  constructor({ configPath, kubernetes, runner, getMineOpsConfig }) {
    this.configPath = configPath;
    this.kubernetes = kubernetes;
    this.runner = runner;
    this.getMineOpsConfig = getMineOpsConfig;
  }

  mineopsConfig() {
    return this.getMineOpsConfig();
  }

  readRaw() {
    if (fs.existsSync(this.configPath)) return fs.readFileSync(this.configPath, 'utf8');
    return this.mineopsConfig().globals.raw.minecraft ?? '';
  }

  parse(instance = this.mineopsConfig().defaultInstance()) {
    return minecraftConfigFor(instance);
  }

  validate(instance = this.mineopsConfig().defaultInstance()) {
    return this.parse(instance);
  }

  setMinecraftVersion(instance, version) {
    if (!/^(LATEST|\d+(\.\d+){1,2})$/i.test(version)) {
      throw new UserInputError('Invalid Minecraft version', { usage: 'mineops update minecraft <version> --instance <name>', examples: ['mineops update minecraft LATEST --instance survival', 'mineops update minecraft 1.21.1 --instance survival'] });
    }

    const raw = this.readRaw();
    const doc = parse(raw) ?? {};
    if (!doc.instances?.[instance.name]?.services?.minecraft) {
      throw new UserInputError(`Minecraft service config not found for instance ${instance.name}`);
    }
    doc.instances[instance.name].services.minecraft.version = version;
    fs.writeFileSync(this.configPath, `${stringify(doc)}`, 'utf8');
  }

  runtimeDiff(instance) {
    const config = this.parse(instance);
    const names = resourceNamesFor(instance);
    const deploy = this.kubernetes.getDeployment(names.minecraftDeployment, instance);
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

  worldMetadataWarnings(instance) {
    const config = this.parse(instance);
    const names = resourceNamesFor(instance);
    const result = this.runner.run('kubectl', ['exec', '-n', instance.namespace, `deployment/${names.minecraftDeployment}`, '--', 'sh', '-lc', 'test -f /data/world/level.dat && echo level.dat-present; test -f /data/server.properties && grep -E "^(level-seed|difficulty|gamemode)=" /data/server.properties || true'], { capture: true, allowFailure: true });
    if (result.status !== 0) return ['Minecraft world metadata is not readable yet.'];
    const warnings = [];
    if (!result.stdout.includes('level.dat-present')) warnings.push('world/level.dat was not found in the running world.');
    const properties = Object.fromEntries(result.stdout.split(/\r?\n/).filter((line) => line.includes('=')).map((line) => line.split('=')));
    if (properties.difficulty && properties.difficulty !== config.world?.difficulty) warnings.push(`world difficulty differs from config: ${properties.difficulty} != ${config.world.difficulty}`);
    if (properties.gamemode && properties.gamemode !== config.world?.mode) warnings.push(`world mode differs from config: ${properties.gamemode} != ${config.world.mode}`);
    return warnings;
  }
}

