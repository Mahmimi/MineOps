import { UserInputError } from '../domain/errors.js';
import { header, print } from '../ui/printer.js';
import { green, yellow } from '../ui/theme.js';

export const configCommand = {
  name: 'config',
  description: 'Show or compare MineOps configuration.',
  usage: 'mineops config show\nmineops config diff',
  examples: ['mineops config show', 'mineops config diff'],
  execute({ args, services }) {
    const [action] = args;
    if (action === 'show') {
      header('MineOps Configuration');
      print(services.config.readRaw().trimEnd());
      return;
    }
    if (action === 'diff') {
      header('MineOps Config Diff');
      const rows = services.config.runtimeDiff();
      for (const row of rows) {
        const state = row.drift ? yellow('DRIFT') : green('OK');
        print(`${state} ${row.key}: config=${row.desired ?? 'unset'} runtime=${row.actual ?? 'unset'}`);
      }
      return;
    }
    throw new UserInputError('Invalid config command', { usage: this.usage, examples: this.examples });
  },
};
