import fs from 'node:fs';
import { ok, warn, header, print } from '../ui/printer.js';
import { ValidationError } from '../domain/errors.js';

export const initCommand = {
  name: 'init',
  description: 'Run the MineOps setup wizard.',
  usage: 'mineops init',
  examples: ['mineops init'],
  execute({ services }) {
    header('MineOps Setup Wizard');
    for (const command of ['docker', 'k3d', 'kubectl', 'terraform', 'node']) {
      services.runner.hasCommand(command) ? ok(command === 'node' ? 'Node.js' : command) : warn(`${command} not found`);
    }
    services.runner.run('docker', ['ps'], { capture: true });
    const env = services.env.load();
    const missing = ['DISCORD_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID', 'PLAYIT_SECRET_KEY'].filter((key) => !env[key]);
    if (missing.length > 0) throw new ValidationError(`Missing required .env values: ${missing.join(', ')}`);
    ok('.env validated');
    fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true });
    fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true });
    ok('host storage prepared');
    const clusters = services.runner.run('k3d', ['cluster', 'list', 'mineops-local'], { capture: true, allowFailure: true });
    const clusterExists = clusters.status === 0 && clusters.stdout.includes('mineops-local');
    clusterExists ? ok('cluster exists') : warn('cluster does not exist; run mineops cluster create');
    if (services.kubernetes.json(['get', 'namespace', 'mineops'])) {
      services.runner.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', services.paths.script('bootstrap-secrets.ps1')]);
      ok('secrets applied');
    } else {
      warn('platform not deployed yet; namespace will be created by mineops deploy');
    }
    print('');
    print(clusterExists ? 'Next: run mineops deploy' : 'Next: run mineops cluster create');
  },
};
