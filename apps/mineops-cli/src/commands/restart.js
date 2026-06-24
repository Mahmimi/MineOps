import { header, ok, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

export const restartCommand = {
  name: 'restart',
  description: 'Restart a supported MineOps component.',
  usage: 'mineops restart minecraft',
  examples: ['mineops restart minecraft'],
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
    header('Restarting Minecraft');
    services.operations.restart(target);
    ok('Minecraft restarted');
  },
};
