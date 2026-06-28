import { UserInputError } from '../domain/errors.js';
import { header, ok, print, warn } from '../ui/printer.js';

export const restoreCommand = {
  name: 'restore',
  description: 'Restore Minecraft world data from a backup.',
  usage: 'mineops restore latest --instance <name>\nmineops restore <backup-name> --instance <name>',
  examples: [
    'mineops restore latest --instance survival',
    'mineops restore backup_2026-06-27_1-30-36 --instance survival',
  ],
  async execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, requireExplicitInstance: true });
    const binding = resolved.bindings[0];
    const [target] = resolved.args;
    if (!target) {
      throw new UserInputError('Restore target is required', {
        usage: this.usage,
        examples: this.examples,
      });
    }
    const backups = binding.backups.listBackups();
    const resolvedTarget = target === 'latest' ? backups[0]?.name : target;
    if (!resolvedTarget) {
      throw new UserInputError('No backups found', {
        usage: this.usage,
        examples: this.examples,
      });
    }

    header(`MineOps Restore (${binding.instance.name})`);
    warn('Minecraft will be stopped during restore.');
    print('');
    print(`Backup: ${resolvedTarget}`);
    print(`Namespace: ${binding.instance.namespace}`);
    print('');
    services.runner.run('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      services.paths.script('restore.ps1'),
      resolvedTarget,
      '-Namespace',
      binding.instance.namespace,
      '-Deployment',
      binding.names.minecraftDeployment,
      '-PvcName',
      binding.names.minecraftPvc,
      '-BackupRoot',
      binding.backups.backupRoot(),
    ]);
    binding.data.appendEvent({ type: 'minecraft', severity: 'INFO', message: `Restore completed from ${resolvedTarget}` });
    ok('Restore Complete');
  },
};
