import { header, print } from '../ui/printer.js';

export const infoCommand = {
  name: 'info',
  description: 'Show platform information and discovery details.',
  usage: 'mineops info',
  examples: ['mineops info'],
  execute({ services, constants }) {
    const s = services.platform.snapshot();
    header('MineOps Information');
    print(`Platform Version: ${constants.version}`);
    print(`Kubernetes Context: ${services.runner.capture('kubectl', ['config', 'current-context'], { allowFailure: true }) || 'unknown'}`);
    print(`Namespace: ${constants.namespace}`);
    print(`Cluster Status: ${s.nodes.length > 0 ? 'Ready' : 'Unavailable'}`);
    print(`Terraform State: ${services.platform.terraformClean() ? 'Clean' : 'Drift detected'}`);
    print(`Discord Status: ${s.discord.state === 'ONLINE' ? 'Connected' : s.discord.state}`);
    print(`Backup Mode: ${s.backupConfig.mode}`);
    print(`Backup Interval: ${s.backupConfig.interval}`);
  },
};
