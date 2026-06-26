import { header, ok, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

export const clusterCommand = {
  name: 'cluster',
  description: 'Inspect or explicitly reset the local k3d cluster.',
  usage: 'mineops cluster <delete|recreate|status>',
  examples: ['mineops cluster status', 'mineops cluster recreate'],
  async execute({ args, services }) {
    const action = args[0];
    if (!action) throw new UserInputError('Missing cluster action', { usage: this.usage, examples: this.examples });
    if (action === 'delete') {
      header('Deleting MineOps Cluster');
      services.runner.run('k3d', ['cluster', 'delete', 'mineops-local'], { allowFailure: true });
      ok('Cluster deleted');
      return;
    }
    if (action === 'recreate') {
      await this.execute({ args: ['delete'], services });
      header('Recreating MineOps Cluster');
      services.clusterManager.ensure({ env: services.env.load({ optional: true }) });
      print('Next: run mineops init');
      return;
    }
    if (action === 'status') {
      const nodes = services.kubernetes.nodes();
      header('Kubernetes Cluster');
      print(`Name: mineops-local`);
      print(`Status: ${nodes.length > 0 ? 'Running' : 'Unavailable'}`);
      print(`Nodes: ${nodes.length}`);
      print(`Version: ${nodes[0]?.status?.nodeInfo?.kubeletVersion ?? 'unknown'}`);
      return;
    }
    throw new UserInputError('Invalid cluster action', { usage: this.usage, examples: this.examples });
  },
};
