import { header, print } from '../ui/printer.js';
import { green, yellow } from '../ui/theme.js';

export const alertsCommand = {
  name: 'alerts',
  description: 'Show alert history and active alerts.',
  usage: 'mineops alerts [--history]',
  examples: ['mineops alerts', 'mineops alerts --history'],
  execute({ args, services }) {
    const history = args.includes('--history');
    const alerts = history
      ? services.data.alerts().slice(-50).reverse()
      : services.data.activeAlerts().slice(0, 10);
    header('Recent Alerts');
    if (alerts.length === 0) {
      print('No active alerts');
      return;
    }
    for (const alert of alerts) {
      print(`[${alert.severity ?? 'INFO'}] ${alert.message}`);
      print(`${services.time.age(alert.timestamp)} ${alert.resolved ? green('RESOLVED') : yellow('ACTIVE')}`);
      print('');
    }
  },
};
