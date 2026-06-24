import { header, print } from '../ui/printer.js';
import { green } from '../ui/theme.js';

export const backupsCommand = {
  name: 'backups',
  description: 'List available backups or show the latest backup.',
  usage: 'mineops backups [latest]',
  examples: ['mineops backups', 'mineops backups latest'],
  execute({ args, services }) {
    const latestOnly = args[0] === 'latest';
    const backups = services.backups.listBackups();
    const config = services.backups.config();
    header(latestOnly ? 'Latest Backup' : 'Available Backups');
    const rows = latestOnly ? backups.slice(0, 1) : backups.slice(0, 20);
    if (rows.length === 0) {
      print('No backups found');
      return;
    }
    rows.forEach((backup, index) => {
      print(`${String(index + 1).padStart(2)}. ${backup.name.padEnd(20)} ${services.format.bytes(backup.sizeBytes).padStart(8)} ${services.time.age(backup.createdAt).padStart(12)} ${green(backup.status)}`);
    });
    print('');
    print(`Backup Mode: ${config.mode} | Limit: ${config.limit}`);
  },
};
