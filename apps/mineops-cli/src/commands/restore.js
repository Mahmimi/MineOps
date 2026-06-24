import { UserInputError } from '../domain/errors.js';
import { header, ok, print, warn } from '../ui/printer.js';

export const restoreCommand = {
  name: 'restore',
  description: 'Restore Minecraft world data from a backup.',
  usage: 'mineops restore latest\nmineops restore <backup-timestamp>',
  examples: [
    'mineops restore latest',
    'mineops restore 2026-06-24_01-30-00',
  ],
  async execute({ args, services }) {
    const [target] = args;
    if (!target) {
      throw new UserInputError('Restore target is required', {
        usage: this.usage,
        examples: this.examples,
      });
    }

    header('MineOps Restore');
    warn('Minecraft will be stopped during restore.');
    print('');
    print('Backup:');
    print(target);
    print('');
    services.runner.run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      services.paths.script('restore.ps1'),
      target,
    ]);
    services.data.appendEvent({ type: 'minecraft', severity: 'INFO', message: `Restore completed from ${target}` });
    ok('Restore Complete');
  },
};
