import { footer, header, print } from '../ui/printer.js';
import { green, red } from '../ui/theme.js';

function health(value) {
  return value ? green('Healthy') : red('Unhealthy');
}

export const healthCommand = {
  name: 'health',
  description: 'Show concise platform health.',
  usage: 'mineops health',
  examples: ['mineops health'],
  execute({ services }) {
    const h = services.platform.health();
    header('MineOps Health');
    print(`Minecraft      ${health(h.minecraft)}`);
    print(`Discord Bot    ${health(h.discord)}`);
    print(`Playit Agent   ${health(h.playit)}`);
    print(`Backups        ${health(h.backups)}`);
    print(`Cluster        ${health(h.cluster)}`);
    print('');
    footer(`Overall Health: ${h.minecraft && h.discord && h.playit && h.backups && h.cluster ? green('HEALTHY') : red('DEGRADED')}`);
  },
};
