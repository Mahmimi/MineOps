import { header, print } from '../ui/printer.js';
import { icons, line } from '../ui/theme.js';

export const metricsCommand = {
  name: 'metrics',
  description: 'Show lightweight platform metrics.',
  usage: 'mineops metrics [--instance <name>]',
  examples: ['mineops metrics', 'mineops metrics --instance survival'],
  execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples });
    const binding = resolved.bindings[0];
    const s = binding.platform.snapshot();
    const latest = binding.backups.listBackups()[0];
    header(`${icons.spark} MineOps Metrics (${binding.instance.name})`);
    print(`${icons.players} Players`);
    print(s.players?.available ? `${s.players.onlineCount} / ${s.players.maxPlayers}` : 'not available');
    print('');
    print(`${icons.disk ?? 'Storage'} World Storage`);
    print(latest ? `${services.format.bytes(latest.sizeBytes)} latest backup; PVC capacity ${s.pvc?.status?.capacity?.storage ?? 'unknown'}` : `PVC capacity ${s.pvc?.status?.capacity?.storage ?? 'unknown'}`);
    print('');
    print(`${icons.backup} Backups`);
    print(`Last Backup: ${services.time.age(s.backup?.completionTime)}`);
    print('');
    print(`${icons.clock} Server Uptime`);
    print(services.time.durationSince(s.pod?.status?.startTime));
    print(line());
  },
};
