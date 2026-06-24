import { print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

export const logsCommand = {
  name: 'logs',
  description: 'Show logs for a MineOps component.',
  usage: 'mineops logs <minecraft|discord|playit|backup>',
  examples: ['mineops logs minecraft', 'mineops logs discord', 'mineops logs playit', 'mineops logs backup'],
  execute({ args, services, constants }) {
    const target = args[0];
    if (!target) {
      print('Available log targets:');
      print('');
      print('1. minecraft');
      print('2. discord');
      print('3. playit');
      print('4. backup');
      print('');
      print('Usage:');
      print('mineops logs minecraft');
      return;
    }
    const map = {
      minecraft: ['logs', '-n', constants.namespace, 'deployment/minecraft', '--tail=120'],
      discord: ['logs', '-n', constants.namespace, 'deployment/discord-bot', '--tail=120'],
      playit: ['logs', '-n', constants.namespace, 'deployment/playit', '--tail=120'],
      backup: ['logs', '-n', constants.namespace, '-l', 'app.kubernetes.io/name=minecraft-backup', '--all-containers=true', '--tail=120'],
    };
    if (!map[target]) throw new UserInputError('Invalid log target', { usage: this.usage, examples: this.examples });
    services.runner.run('kubectl', map[target], { allowFailure: target === 'backup' });
  },
};
