import { UserInputError } from '../domain/errors.js';
import { header, print } from '../ui/printer.js';
import { green, yellow } from '../ui/theme.js';

function renderInstanceConfig(binding) {
  const config = binding.config.parse();
  return JSON.stringify({
    instance: binding.instance.name,
    namespace: binding.instance.namespace,
    services: {
      minecraft: config,
      backup: binding.instance.service('backup')?.config ?? {},
      playit: binding.instance.service('playit')?.config ?? {},
      discord: {
        guildId: binding.instance.service('discord')?.config?.guildId ?? '',
        alertChannelId: binding.instance.service('discord')?.config?.alertChannelId ?? '',
      },
    },
  }, null, 2);
}

function hasTargetFlags(args) {
  return args.some((arg) => arg === '--instance' || arg.startsWith('--instance=') || arg === '--all');
}

export const configCommand = {
  name: 'config',
  description: 'Show, validate, or inspect MineOps configuration.',
  usage: 'mineops config show [--instance <name>]\nmineops config diff [--instance <name>]\nmineops config validate [--instance <name>|--all]\nmineops config graph',
  examples: ['mineops config show', 'mineops config show --instance survival', 'mineops config validate', 'mineops config graph'],
  execute({ args, services }) {
    const [action = 'show', ...rest] = args;
    if (action === 'show') {
      if (!hasTargetFlags(rest)) {
        header('MineOps Configuration');
        print(services.config.readRaw().trimEnd());
        return;
      }
      const resolved = services.resolveTargets(rest, { usage: this.usage, examples: this.examples });
      header(`MineOps Configuration (${resolved.targets[0].name})`);
      print(renderInstanceConfig(resolved.bindings[0]));
      return;
    }
    if (action === 'diff') {
      const resolved = services.resolveTargets(rest, { usage: this.usage, examples: this.examples });
      const binding = resolved.bindings[0];
      header(`MineOps Config Diff (${binding.instance.name})`);
      const rows = binding.config.runtimeDiff();
      for (const row of rows) {
        const state = row.drift ? yellow('DRIFT') : green('OK');
        print(`${state} ${row.key}: config=${row.desired ?? 'unset'} runtime=${row.actual ?? 'unset'}`);
      }
      return;
    }
    if (action === 'validate') {
      const resolved = services.resolveTargets(rest, { usage: this.usage, examples: this.examples, allowAll: true });
      header('MineOps Configuration Validation');
      services.loadMineOpsConfig();
      print(green('MineOpsConfig is valid'));
      for (const binding of resolved.bindings) {
        const warnings = binding.config.worldMetadataWarnings();
        print('');
        print(`${binding.instance.name}: ${warnings.length === 0 ? green('OK') : yellow('warnings')}`);
        for (const item of warnings) print(`- ${item}`);
      }
      return;
    }
    if (action === 'graph') {
      const mineopsConfig = services.loadMineOpsConfig();
      header('MineOps Config Graph');
      for (const instance of mineopsConfig.instances) {
        const servicesList = instance.services.map((service) => service.type).join(', ');
        print(`${instance.name} -> namespace=${instance.namespace} -> ${servicesList}`);
      }
      return;
    }
    throw new UserInputError('Invalid config command', { usage: this.usage, examples: this.examples });
  },
};
