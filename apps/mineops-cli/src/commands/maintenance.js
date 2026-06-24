import { header, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

export const maintenanceCommand = {
  name: 'maintenance',
  description: 'Enable or disable maintenance mode.',
  usage: 'mineops maintenance on|off',
  examples: ['mineops maintenance on', 'mineops maintenance off'],
  execute({ args, services }) {
    const mode = args[0];
    if (!['on', 'off'].includes(mode)) {
      throw new UserInputError('Invalid maintenance command', {
        usage: this.usage,
        examples: this.examples,
      });
    }
    services.data.setMaintenance(mode === 'on', args.slice(1).join(' ') || 'Scheduled maintenance');
    header(mode === 'on' ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled');
    print(mode === 'on' ? 'Alerts are muted. Status in Discord will show maintenance.' : 'Alerts are active. Platform returned to normal operation.');
  },
};
