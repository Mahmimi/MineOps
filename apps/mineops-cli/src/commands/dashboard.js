import { card, print } from '../ui/printer.js';
import { green, red, yellow } from '../ui/theme.js';

function state(value) {
  if (value === 'ONLINE') return green('ONLINE');
  if (value === 'SCALED TO 0') return yellow(value);
  return red(value);
}

export const dashboardCommand = {
  name: 'dashboard',
  description: 'Show a terminal dashboard.',
  usage: 'mineops dashboard [--once]',
  examples: ['mineops dashboard', 'mineops dashboard --once'],
  async execute({ args, services }) {
    const once = args.includes('--once');
    do {
      const s = services.platform.snapshot();
      if (!once) console.clear();
      card('Minecraft', [
        ['Status', state(s.minecraft.state)],
        ['Players', s.players?.available ? `${s.players.onlineCount} / ${s.players.maxPlayers}` : 'unknown'],
        ['Uptime', services.time.durationSince(s.pod?.status?.startTime)],
      ]);
      card('Platform', [
        ['Cluster', s.nodes.length > 0 ? green('HEALTHY') : red('UNAVAILABLE')],
        ['Discord Bot', state(s.discord.state)],
        ['Playit Agent', state(s.playit.state)],
        ['Backups', s.backup?.complete ? green('HEALTHY') : yellow('UNKNOWN')],
      ]);
      card('Operations', [
        ['Maintenance', s.maintenance.enabled ? yellow('ON') : green('OFF')],
        ['Alerts', `${services.data.alerts().filter((alert) => !alert.resolved).length} active`],
      ]);
      print('Press Ctrl+C to exit. Refresh: 10s');
      if (once) break;
      await new Promise((resolve) => setTimeout(resolve, 10000));
    } while (true);
  },
};
