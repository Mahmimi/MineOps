import { header, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

export const maintenanceCommand = {
  name: 'maintenance',
  description: 'Enable or disable maintenance mode.',
  usage: 'mineops maintenance on|off [--instance <name>|--all] [reason]',
  examples: ['mineops maintenance on --instance survival Scheduled maintenance', 'mineops maintenance off --all'],
  execute({ args, services }) {
    const mode = args[0];
    if (!['on', 'off'].includes(mode)) {
      throw new UserInputError('Invalid maintenance command', {
        usage: this.usage,
        examples: this.examples,
      });
    }
    const resolved = services.resolveTargets(args.slice(1), { usage: this.usage, examples: this.examples, allowAll: true });
    const reason = resolved.args.join(' ') || 'Scheduled maintenance';
    for (const binding of resolved.bindings) {
      binding.data.setMaintenance(mode === 'on', reason);
      header(`${mode === 'on' ? 'Maintenance Mode Enabled' : 'Maintenance Mode Disabled'} (${binding.instance.name})`);
      print(mode === 'on' ? 'Alerts are muted. Status in Discord will show maintenance.' : 'Alerts are active. Platform returned to normal operation.');
    }
  },
};
