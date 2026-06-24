import { header, ok, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

function runScale({ args, services, action }) {
  const target = args[0];
  if (!target) {
    print(`Available ${action} targets:`);
    print('');
    print('1. minecraft');
    print('');
    print('Usage:');
    print(`mineops ${action} minecraft`);
    return;
  }
  if (target !== 'minecraft') throw new UserInputError(`Invalid ${action} target`, { usage: `mineops ${action} minecraft`, examples: [`mineops ${action} minecraft`] });
  header(`${action === 'start' ? 'Starting' : 'Stopping'} Minecraft`);
  services.operations.scale('minecraft', action === 'start' ? 1 : 0);
  ok(`Minecraft ${action === 'start' ? 'started' : 'stopped'}`);
}

export const startCommand = {
  name: 'start',
  description: 'Start a supported MineOps component.',
  usage: 'mineops start minecraft',
  examples: ['mineops start minecraft'],
  execute(context) { runScale({ ...context, action: 'start' }); },
};

export const stopCommand = {
  name: 'stop',
  description: 'Stop a supported MineOps component.',
  usage: 'mineops stop minecraft',
  examples: ['mineops stop minecraft'],
  execute(context) { runScale({ ...context, action: 'stop' }); },
};
