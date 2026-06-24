import { header, print } from '../ui/printer.js';
import { icons } from '../ui/theme.js';

function eventIcon(severity) {
  if (severity === 'WARN') return icons.warn;
  if (severity === 'ERROR') return icons.fail;
  return icons.ok;
}

function shortTime(timestamp) {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? '??:??' : date.toISOString().slice(11, 16);
}

export const timelineCommand = {
  name: 'timeline',
  description: 'Show chronological platform events.',
  usage: 'mineops timeline [--type backup|deployment|maintenance|minecraft|platform|alerts]',
  examples: ['mineops timeline', 'mineops timeline --type backup'],
  execute({ args, services }) {
    const typeIndex = args.indexOf('--type');
    const filter = typeIndex >= 0 ? args[typeIndex + 1] : null;
    const job = services.backups.latestJob();
    const pod = services.kubernetes.podFor('app.kubernetes.io/name=minecraft');
    const generated = [];
    if (job?.complete) generated.push({ timestamp: job.completionTime, type: 'backup', severity: 'INFO', message: 'Backup completed' });
    if (job?.failed) generated.push({ timestamp: job.startTime, type: 'backup', severity: 'WARN', message: 'Backup failed' });
    if (pod?.status?.startTime) generated.push({ timestamp: pod.status.startTime, type: 'minecraft', severity: 'INFO', message: 'Minecraft started' });
    const alerts = services.data.alerts().map((alert) => ({ ...alert, type: 'alerts' }));
    let events = [...generated, ...services.data.events(), ...alerts];
    if (filter) events = events.filter((event) => event.type === filter);
    const seen = new Set();
    events = events
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .filter((event) => {
        const timestamp = new Date(event.timestamp);
        const minute = Number.isNaN(timestamp.getTime()) ? 'unknown' : timestamp.toISOString().slice(0, 16);
        const key = `${event.severity}:${event.message}:${minute}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);
    header(`${icons.clock} MineOps Timeline`);
    if (events.length === 0) {
      print('No events recorded');
      return;
    }
    for (const event of events) print(`${eventIcon(event.severity)} [${shortTime(event.timestamp)}] ${event.message} (${services.time.age(event.timestamp)})`);
    print('');
    print(`Showing latest ${events.length} events`);
  },
};
