import { UserInputError } from '../domain/errors.js';

function invalidTargetError(message, usage, examples = []) {
  return new UserInputError(message, { usage, examples });
}

export class InstanceResolver {
  constructor({ loadMineOpsConfig }) {
    this.loadMineOpsConfig = loadMineOpsConfig;
  }

  parseArgs(args, { usage, examples } = {}) {
    const positional = [];
    let instanceName = null;
    let all = false;

    for (let index = 0; index < args.length; index += 1) {
      const arg = args[index];
      if (arg === '--all') {
        all = true;
        continue;
      }
      if (arg === '--instance') {
        const value = args[index + 1];
        if (!value || value.startsWith('--')) {
          throw invalidTargetError('Missing value for --instance', usage, examples);
        }
        instanceName = value;
        index += 1;
        continue;
      }
      if (arg.startsWith('--instance=')) {
        instanceName = arg.slice('--instance='.length);
        if (!instanceName) throw invalidTargetError('Missing value for --instance', usage, examples);
        continue;
      }
      positional.push(arg);
    }

    if (all && instanceName) {
      throw invalidTargetError('Use either --instance or --all, not both', usage, examples);
    }

    return { positional, instanceName, all };
  }

  resolveTargets(args, {
    usage,
    examples = [],
    allowAll = false,
    requireExplicitInstance = false,
  } = {}) {
    const parsed = this.parseArgs(args, { usage, examples });
    const mineopsConfig = this.loadMineOpsConfig();
    const instances = mineopsConfig.instances ?? [];

    if (instances.length === 0) {
      throw invalidTargetError('MineOps configuration has no instances', usage, examples);
    }

    if (parsed.all) {
      if (!allowAll) throw invalidTargetError('This command does not support --all', usage, examples);
      return { mineopsConfig, args: parsed.positional, targets: instances, selection: { mode: 'all' } };
    }

    if (parsed.instanceName) {
      const instance = instances.find((candidate) => candidate.name === parsed.instanceName);
      if (!instance) {
        throw invalidTargetError(`Unknown instance: ${parsed.instanceName}`, usage, examples);
      }
      return { mineopsConfig, args: parsed.positional, targets: [instance], selection: { mode: 'instance', name: instance.name } };
    }

    if (requireExplicitInstance) {
      throw invalidTargetError('This command requires --instance', usage, examples);
    }

    if (instances.length === 1) {
      return { mineopsConfig, args: parsed.positional, targets: [instances[0]], selection: { mode: 'default', name: instances[0].name } };
    }

    throw invalidTargetError('Multiple instances exist. Use --instance <name> or --all.', usage, examples);
  }
}
