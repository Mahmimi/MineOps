import { print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

function parseTarget(args) {
  const first = args[0];
  if (!first || first.startsWith('--')) return { target: 'minecraft', args };
  return { target: first, args: args.slice(1) };
}

export const logsCommand = {
  name: 'logs',
  description: 'Show logs for a MineOps component.',
  usage: 'mineops logs [minecraft|discord|playit|backup] [--instance <name>|--all]',
  examples: ['mineops logs --instance survival', 'mineops logs minecraft --instance survival', 'mineops logs backup --all'],
  execute({ args, services }) {
    const parsed = parseTarget(args);
    const resolved = services.resolveTargets(parsed.args, { usage: this.usage, examples: this.examples, allowAll: true });
    const map = {
      minecraft: (binding) => ['logs', '-n', binding.instance.namespace, `deployment/${binding.names.minecraftDeployment}`, '--tail=120'],
      discord: (binding) => ['logs', '-n', binding.instance.namespace, `deployment/${binding.names.discordDeployment}`, '--tail=120'],
      playit: (binding) => ['logs', '-n', binding.instance.namespace, `deployment/${binding.names.playitDeployment}`, '--tail=120'],
      backup: (binding) => ['logs', '-n', binding.instance.namespace, '-l', binding.names.backupSelector, '--all-containers=true', '--tail=120'],
    };
    if (!map[parsed.target]) throw new UserInputError('Invalid log target', { usage: this.usage, examples: this.examples });

    for (const binding of resolved.bindings) {
      if (resolved.bindings.length > 1) {
        print(`=== ${binding.instance.name} (${parsed.target}) ===`);
      }
      services.runner.run('kubectl', map[parsed.target](binding), { allowFailure: parsed.target === 'backup' });
    }
  },
};
