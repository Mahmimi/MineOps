import { header, print } from '../ui/printer.js';
import { icons } from '../ui/theme.js';
import { localMinute, localShortTime, parseTimestamp } from '../../../utils/time.js';

function eventIcon(severity) {
  if (severity === 'WARN') return icons.warn;
  if (severity === 'ERROR') return icons.fail;
  return icons.ok;
}

function shortTime(timestamp) {
  return localShortTime(timestamp);
}

export const timelineCommand = {
  name: 'timeline',
  description: 'Show chronological platform events.',
  usage: 'mineops timeline [--type backup|deployment|maintenance|minecraft|platform|alerts] [--instance <name>|--all]',
  examples: ['mineops timeline', 'mineops timeline --type backup', 'mineops timeline --instance survival'],
  execute({ args, services }) {
    const typeIndex = args.indexOf('--type');
    const filter = typeIndex >= 0 ? args[typeIndex + 1] : null;
    const filteredArgs = typeIndex >= 0 ? args.filter((_, index) => index !== typeIndex && index !== typeIndex + 1) : args;
    const resolved = services.resolveTargets(filteredArgs, { usage: this.usage, examples: this.examples, allowAll: true });
    for (const binding of resolved.bindings) {
      const job = binding.backups.latestJob();
      const pod = binding.kubernetes.podFor(binding.names.minecraftSelector);
      const generated = [];
      if (job?.complete) generated.push({ timestamp: job.completionTime, type: 'backup', severity: 'INFO', message: 'Backup completed' });
      if (job?.failed) generated.push({ timestamp: job.startTime, type: 'backup', severity: 'WARN', message: 'Backup failed' });
      if (pod?.status?.startTime) generated.push({ timestamp: pod.status.startTime, type: 'minecraft', severity: 'INFO', message: 'Minecraft started' });
      const alerts = binding.data.alerts().map((alert) => ({ ...alert, type: 'alerts' }));
      let events = [...generated, ...binding.data.events(), ...alerts];
      if (filter) events = events.filter((event) => event.type === filter);
      const seen = new Set();
      events = events
        .sort((a, b) => parseTimestamp(b.timestamp) - parseTimestamp(a.timestamp))
        .filter((event) => {
          const minute = localMinute(event.timestamp);
          const key = `${event.severity}:${event.message}:${minute}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 20);
      header(`${icons.clock} MineOps Timeline (${binding.instance.name})`);
      if (events.length === 0) {
        print('No events recorded');
      } else {
        for (const event of events) print(`${eventIcon(event.severity)} [${shortTime(event.timestamp)}] ${event.message} (${services.time.age(event.timestamp)})`);
      }
      print('');
      print(`Showing latest ${events.length} events`);
      print('');
    }
  },
};
