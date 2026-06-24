import { header, print } from '../ui/printer.js';
import { green, red } from '../ui/theme.js';

export const backupCommand = {
  name: 'backup',
  description: 'Trigger a manual backup.',
  usage: 'mineops backup',
  examples: ['mineops backup'],
  execute({ services, constants }) {
    const name = `mineops-manual-backup-${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}`;
    header('Backup Started');
    services.data.appendEvent({ type: 'backup', severity: 'INFO', message: 'Backup started' });
    services.runner.run('kubectl', ['create', 'job', '-n', constants.namespace, name, '--from=cronjob/minecraft-backup']);
    const wait = services.runner.run('kubectl', ['wait', '-n', constants.namespace, '--for=condition=complete', `job/${name}`, '--timeout=300s'], { allowFailure: true });
    services.data.appendEvent({ type: 'backup', severity: wait.status === 0 ? 'INFO' : 'ERROR', message: wait.status === 0 ? 'Backup completed' : 'Backup failed' });
    const latest = services.backups.listBackups()[0];
    print('Mode:');
    print(services.backups.config().mode);
    print('');
    print('Result:');
    print(wait.status === 0 ? green('Success') : red('Failed'));
    print('');
    print('Location:');
    print(`backups/${latest?.name ?? 'not available'}`);
    if (wait.status !== 0) process.exitCode = 1;
  },
};
