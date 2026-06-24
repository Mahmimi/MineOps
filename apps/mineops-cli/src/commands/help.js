import { print, usage } from '../ui/printer.js';

export const helpCommand = {
  name: 'help',
  description: 'Show MineOps command help.',
  usage: 'mineops help [command]',
  examples: ['mineops help', 'mineops logs --help'],
  execute({ args, registry }) {
    const target = args[0];
    if (target && registry.has(target)) {
      usage(registry.get(target));
      return;
    }
    print('MineOps Commands');
    print('');
    for (const command of [...registry.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      print(`${command.name.padEnd(14)} ${command.description}`);
    }
    print('');
    print('Use: mineops <command> --help');
  },
};
