import { UserInputError } from '../domain/errors.js';

const targetMap = {
  minecraft: (binding) => `deployment/${binding.names.minecraftDeployment}`,
  discord: (binding) => `deployment/${binding.names.discordDeployment}`,
  playit: (binding) => `deployment/${binding.names.playitDeployment}`,
};

export const shellCommand = {
  name: 'shell',
  description: 'Open a shell in a MineOps workload.',
  usage: 'mineops shell <minecraft|discord|playit> --instance <name>',
  examples: ['mineops shell minecraft --instance survival', 'mineops shell discord --instance survival'],
  execute({ args, services }) {
    const [target, ...rest] = args;
    if (!targetMap[target]) {
      throw new UserInputError('Invalid shell target', { usage: this.usage, examples: this.examples });
    }
    const resolved = services.resolveTargets(rest, { usage: this.usage, examples: this.examples, requireExplicitInstance: true });
    const binding = resolved.bindings[0];
    services.runner.run('kubectl', ['exec', '-it', '-n', binding.instance.namespace, targetMap[target](binding), '--', 'sh']);
  },
};
