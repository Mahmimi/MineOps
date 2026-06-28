import { header, print } from '../ui/printer.js';
import { green, red } from '../ui/theme.js';
import { localCompactTimestamp } from '../../../utils/time.js';

export const backupCommand = {
  name: 'backup',
  description: 'Trigger a manual backup.',
  usage: 'mineops backup [--instance <name>|--all]',
  examples: ['mineops backup', 'mineops backup --instance survival', 'mineops backup --all'],
  execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, allowAll: true });
    for (const binding of resolved.bindings) {
      const safeName = binding.instance.name.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
      const name = `mineops-manual-backup-${safeName}-${localCompactTimestamp()}`;
      header(`Backup Started (${binding.instance.name})`);
      binding.data.appendEvent({ type: 'backup', severity: 'INFO', message: 'Backup started' });
      services.runner.run('kubectl', ['create', 'job', '-n', binding.instance.namespace, name, `--from=cronjob/${binding.names.backupCronJob}`]);
      const wait = services.runner.run('kubectl', ['wait', '-n', binding.instance.namespace, '--for=condition=complete', `job/${name}`, '--timeout=300s'], { allowFailure: true });
      binding.data.appendEvent({ type: 'backup', severity: wait.status === 0 ? 'INFO' : 'ERROR', message: wait.status === 0 ? 'Backup completed' : 'Backup failed' });
      const latest = binding.backups.listBackups()[0];
      print(`Mode: ${binding.backups.config().mode}`);
      print(`Result: ${wait.status === 0 ? green('Success') : red('Failed')}`);
      print(`Location: ${latest?.path ?? 'not available'}`);
      print('');
      if (wait.status !== 0) process.exitCode = 1;
    }
  },
};
