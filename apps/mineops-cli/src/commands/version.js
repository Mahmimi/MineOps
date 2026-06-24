import { header, print } from '../ui/printer.js';

export const versionCommand = {
  name: 'version',
  description: 'Show MineOps version metadata.',
  usage: 'mineops version',
  examples: ['mineops version'],
  execute({ services, constants }) {
    const commit = services.runner.capture('git', ['rev-parse', '--short', 'HEAD'], { allowFailure: true }) || 'unknown';
    header('MineOps Version');
    print(`MineOps Version: ${constants.version}`);
    print(`Git Commit: ${commit}`);
    print(`Build Date: ${new Date().toISOString().slice(0, 10)}`);
  },
};
