import { header, print } from '../ui/printer.js';

export const infoCommand = {
  name: 'info',
  description: 'Show platform information and discovery details.',
  usage: 'mineops info [--instance <name>|--all]',
  examples: ['mineops info', 'mineops info --instance survival', 'mineops info --all'],
  execute({ args, services, constants }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, allowAll: true });
    const context = services.runner.capture('kubectl', ['config', 'current-context'], { allowFailure: true }) || 'unknown';
    const mineopsConfig = resolved.mineopsConfig;
    for (const binding of resolved.bindings) {
      const s = binding.platform.snapshot();
      header(`MineOps Information (${binding.instance.name})`);
      print(`Platform Version: ${constants.version}`);
      print(`Kubernetes Context: ${context}`);
      print(`Namespace: ${binding.instance.namespace}`);
      print(`Cluster Status: ${s.nodes.length > 0 ? 'Ready' : 'Unavailable'}`);
      print(`Terraform State: ${binding.platform.terraformClean(mineopsConfig) ? 'Clean' : 'Drift detected'}`);
      print(`Discord Status: ${s.discord.state === 'ONLINE' ? 'Connected' : s.discord.state}`);
      print(`Backup Mode: ${s.backupConfig.mode}`);
      print(`Backup Interval: ${s.backupConfig.interval}`);
      print('');
    }
  },
};
