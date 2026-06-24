import { footer, header, print } from '../ui/printer.js';
import { green, icons, red, yellow } from '../ui/theme.js';

function state(value) {
  if (value === 'ONLINE') return green('Running');
  if (value === 'SCALED TO 0') return yellow(value);
  return red(value);
}

export const statusCommand = {
  name: 'status',
  description: 'Show platform status.',
  usage: 'mineops status',
  examples: ['mineops status'],
  execute({ services }) {
    const s = services.platform.snapshot();
    const backupHealthy = s.backup?.complete ? 'Healthy' : s.backup?.failed ? 'Failed' : 'No completed backup yet';
    const clusterReady = s.nodes.length > 0 ? 'Ready' : 'Unavailable';
    const overall = s.minecraft.state === 'ONLINE' && s.discord.state === 'ONLINE' && s.playit.publicReady && clusterReady === 'Ready' && backupHealthy !== 'Failed' && !s.maintenance.enabled;
    header(`${icons.spark} MineOps Platform Status`);
    print(`${icons.game} Minecraft`);
    print(state(s.minecraft.state));
    print(`Uptime: ${s.pod?.status?.startTime ? services.time.durationSince(s.pod.status.startTime) : 'not available'}`);
    print('');
    print(`${icons.bot} Discord Bot`);
    print(s.discord.state === 'ONLINE' ? green('Connected') : state(s.discord.state));
    print('');
    print(`${icons.tunnel} Playit Agent`);
    print(s.playit.publicReady ? green('Ready for public joins') : yellow(s.playit.reason));
    print(`Ready: ${s.playit.ready} / ${s.playit.desired}`);
    print(`Minecraft endpoints: ${s.playit.minecraftEndpointCount}`);
    print('');
    print(`${icons.backup} Backups`);
    print(backupHealthy === 'Healthy' ? green('Healthy') : yellow(backupHealthy));
    print('');
    print(`${icons.cluster} Cluster`);
    print(clusterReady === 'Ready' ? green('Ready') : red(clusterReady));
    print('');
    print(`${icons.wrench} Maintenance`);
    print(s.maintenance.enabled ? yellow('ON') : green('OFF'));
    footer(`Overall Health: ${overall ? green('HEALTHY') : yellow('MAINTENANCE/DEGRADED')}`);
  },
};
