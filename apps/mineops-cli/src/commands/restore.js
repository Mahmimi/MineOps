import { UserInputError } from '../domain/errors.js';
import { header, ok, print, warn } from '../ui/printer.js';

export const restoreCommand = {
  name: 'restore',
  description: 'Restore Minecraft world data from a backup.',
  usage: 'mineops restore latest\nmineops restore <backup-name>',
  examples: [
    'mineops restore latest',
    'mineops restore backup_2026-06-27_1-30-36',
  ],
  async execute({ args, services }) {
    const [target] = args;
    if (!target) {
      throw new UserInputError('Restore target is required', {
        usage: this.usage,
        examples: this.examples,
      });
    }
    const backups = services.backups.listBackups();
    const resolvedTarget = target === 'latest' ? backups[0]?.name : target;
    if (!resolvedTarget) {
      throw new UserInputError('No backups found', {
        usage: this.usage,
        examples: this.examples,
      });
    }

    header('MineOps Restore');
    warn('Minecraft will be stopped during restore.');
    print('');
    print('Backup:');
    print(resolvedTarget);
    print('');
    services.runner.run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      services.paths.script('restore.ps1'),
      resolvedTarget,
    ]);
    services.data.appendEvent({ type: 'minecraft', severity: 'INFO', message: `Restore completed from ${resolvedTarget}` });
    ok('Restore Complete');
  },
};
