import { footer, header, print } from '../ui/printer.js';
import { green, icons, red, yellow } from '../ui/theme.js';

function state(value) {
  if (value === 'ONLINE') return green('Running');
  if (value === 'SCALED TO 0') return yellow(value);
  return red(value);
}

function overallHealth(snapshot) {
  const backupHealthy = snapshot.backup?.complete ? 'Healthy' : snapshot.backup?.failed ? 'Failed' : 'No completed backup yet';
  const clusterReady = snapshot.nodes.length > 0 ? 'Ready' : 'Unavailable';
  return snapshot.minecraft.state === 'ONLINE' && snapshot.discord.state === 'ONLINE' && snapshot.playit.publicReady && clusterReady === 'Ready' && backupHealthy !== 'Failed' && !snapshot.maintenance.enabled;
}

function printInstanceStatus(binding, services) {
  const s = binding.platform.snapshot();
  const backupHealthy = s.backup?.complete ? 'Healthy' : s.backup?.failed ? 'Failed' : 'No completed backup yet';
  const clusterReady = s.nodes.length > 0 ? 'Ready' : 'Unavailable';
  const overall = overallHealth(s);

  header(`${icons.spark} MineOps Platform Status (${binding.instance.name})`);
  print(`Namespace: ${binding.instance.namespace}`);
  print('');
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
}

export const statusCommand = {
  name: 'status',
  description: 'Show platform status.',
  usage: 'mineops status [--instance <name>|--all]',
  examples: ['mineops status', 'mineops status --instance survival', 'mineops status --all'],
  execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, allowAll: true });
    if (resolved.targets.length === 1) {
      printInstanceStatus(resolved.bindings[0], services);
      return;
    }

    header(`${icons.spark} MineOps Platform Status`);
    for (const binding of resolved.bindings) {
      const s = binding.platform.snapshot();
      const health = overallHealth(s) ? green('HEALTHY') : yellow('DEGRADED');
      print(`${binding.instance.name} | ${binding.instance.namespace} | Minecraft=${s.minecraft.state} | Discord=${s.discord.state} | Playit=${s.playit.publicReady ? 'READY' : 'BLOCKED'} | Backup=${s.backup?.complete ? 'OK' : 'PENDING'} | PVC=${s.pvc?.status?.phase ?? 'UNKNOWN'} | Health=${health}`);
    }
  },
};
