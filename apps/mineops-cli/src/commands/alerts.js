import { header, print } from '../ui/printer.js';
import { green, yellow } from '../ui/theme.js';

export const alertsCommand = {
  name: 'alerts',
  description: 'Show alert history and active alerts.',
  usage: 'mineops alerts [--history] [--instance <name>|--all]',
  examples: ['mineops alerts', 'mineops alerts --history', 'mineops alerts --instance survival'],
  execute({ args, services }) {
    const history = args.includes('--history');
    const filteredArgs = args.filter((arg, index) => !(arg === '--history' || (args[index - 1] === '--type' && index > 0)));
    const resolved = services.resolveTargets(filteredArgs, { usage: this.usage, examples: this.examples, allowAll: true });
    for (const binding of resolved.bindings) {
      const alerts = history ? binding.data.alerts().slice(-50).reverse() : binding.data.activeAlerts().slice(0, 10);
      header(`Recent Alerts (${binding.instance.name})`);
      if (alerts.length === 0) {
        print('No active alerts');
        continue;
      }
      for (const alert of alerts) {
        print(`[${alert.severity ?? 'INFO'}] ${alert.message}`);
        print(`${services.time.age(alert.timestamp)} ${alert.resolved ? green('RESOLVED') : yellow('ACTIVE')}`);
        print('');
      }
    }
  },
};
