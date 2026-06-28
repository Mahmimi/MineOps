import { header, ok, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

export const restartCommand = {
  name: 'restart',
  description: 'Restart a supported MineOps component.',
  usage: 'mineops restart minecraft [--instance <name>]',
  examples: ['mineops restart minecraft', 'mineops restart minecraft --instance survival'],
  execute({ args, services }) {
    const target = args[0];
    if (!target) {
      print('Available restart targets:');
      print('');
      print('1. minecraft');
      print('');
      print('Usage:');
      print(this.usage);
      return;
    }
    if (target !== 'minecraft') throw new UserInputError('Invalid restart target', { usage: this.usage, examples: this.examples });
    const resolved = services.resolveTargets(args.slice(1), { usage: this.usage, examples: this.examples });
    for (const binding of resolved.bindings) {
      header(`Restarting Minecraft (${binding.instance.name})`);
      binding.operations.restart(binding.names.minecraftDeployment);
      ok('Minecraft restarted');
    }
  },
};
