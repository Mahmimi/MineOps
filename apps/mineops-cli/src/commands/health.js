import { footer, header, print } from '../ui/printer.js';
import { green, red } from '../ui/theme.js';

function health(value) {
  return value ? green('Healthy') : red('Unhealthy');
}

export const healthCommand = {
  name: 'health',
  description: 'Show concise platform health.',
  usage: 'mineops health [--instance <name>|--all]',
  examples: ['mineops health', 'mineops health --instance survival', 'mineops health --all'],
  execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, allowAll: true });
    if (resolved.bindings.length === 1) {
      const binding = resolved.bindings[0];
      const h = binding.platform.health();
      header(`MineOps Health (${binding.instance.name})`);
      print(`Minecraft      ${health(h.minecraft)}`);
      print(`Discord Bot    ${health(h.discord)}`);
      print(`Playit Agent   ${health(h.playit)}`);
      print(`Backups        ${health(h.backups)}`);
      print(`Cluster        ${health(h.cluster)}`);
      print('');
      footer(`Overall Health: ${h.minecraft && h.discord && h.playit && h.backups && h.cluster ? green('HEALTHY') : red('DEGRADED')}`);
      return;
    }

    header('MineOps Health');
    for (const binding of resolved.bindings) {
      const h = binding.platform.health();
      const overall = h.minecraft && h.discord && h.playit && h.backups && h.cluster;
      print(`${binding.instance.name}: ${overall ? green('HEALTHY') : red('DEGRADED')} | Minecraft=${health(h.minecraft)} | Discord=${health(h.discord)} | Playit=${health(h.playit)} | Backups=${health(h.backups)}`);
    }
  },
};
