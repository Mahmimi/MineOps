import { header, ok, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

function runScale({ args, services, action, usage, examples }) {
  const target = args[0];
  if (!target) {
    print(`Available ${action} targets:`);
    print('');
    print('1. minecraft');
    print('');
    print('Usage:');
    print(usage);
    return;
  }
  if (target !== 'minecraft') throw new UserInputError(`Invalid ${action} target`, { usage, examples });
  const resolved = services.resolveTargets(args.slice(1), { usage, examples });
  for (const binding of resolved.bindings) {
    header(`${action === 'start' ? 'Starting' : 'Stopping'} Minecraft (${binding.instance.name})`);
    binding.operations.scale(binding.names.minecraftDeployment, action === 'start' ? 1 : 0);
    ok(`Minecraft ${action === 'start' ? 'started' : 'stopped'}`);
  }
}

export const startCommand = {
  name: 'start',
  description: 'Start a supported MineOps component.',
  usage: 'mineops start minecraft [--instance <name>]',
  examples: ['mineops start minecraft', 'mineops start minecraft --instance survival'],
  execute(context) { runScale({ ...context, action: 'start', usage: this.usage, examples: this.examples }); },
};

export const stopCommand = {
  name: 'stop',
  description: 'Stop a supported MineOps component.',
  usage: 'mineops stop minecraft [--instance <name>]',
  examples: ['mineops stop minecraft', 'mineops stop minecraft --instance survival'],
  execute(context) { runScale({ ...context, action: 'stop', usage: this.usage, examples: this.examples }); },
};
