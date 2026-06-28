import { header, print } from '../ui/printer.js';
import { green } from '../ui/theme.js';

export const backupsCommand = {
  name: 'backups',
  description: 'List available backups or show the latest backup.',
  usage: 'mineops backups [latest] [--instance <name>|--all]',
  examples: ['mineops backups', 'mineops backups latest', 'mineops backups --instance survival'],
  execute({ args, services }) {
    const latestOnly = args[0] === 'latest';
    const remainingArgs = latestOnly ? args.slice(1) : args;
    const resolved = services.resolveTargets(remainingArgs, { usage: this.usage, examples: this.examples, allowAll: true });
    for (const binding of resolved.bindings) {
      const backups = binding.backups.listBackups();
      const config = binding.backups.config();
      header(`${latestOnly ? 'Latest Backup' : 'Available Backups'} (${binding.instance.name})`);
      const rows = latestOnly ? backups.slice(0, 1) : backups.slice(0, 20);
      if (rows.length === 0) {
        print('No backups found');
      } else {
        rows.forEach((backup, index) => {
          print(`${String(index + 1).padStart(2)}. ${backup.name.padEnd(20)} ${services.format.bytes(backup.sizeBytes).padStart(8)} ${services.time.age(backup.createdAt).padStart(12)} ${green(backup.status)}`);
        });
      }
      print('');
      print(`Backup Root: ${binding.backups.backupRoot()}`);
      print(`Backup Mode: ${config.mode} | Limit: ${config.limit}`);
      print('');
    }
  },
};
