import fs from 'node:fs';
import { header, ok, print } from '../ui/printer.js';
import { UserInputError } from '../domain/errors.js';

export const clusterCommand = {
  name: 'cluster',
  description: 'Manage the local k3d cluster.',
  usage: 'mineops cluster <create|delete|recreate|status>',
  examples: ['mineops cluster create', 'mineops cluster status'],
  async execute({ args, services }) {
    const action = args[0];
    if (!action) throw new UserInputError('Missing cluster action', { usage: this.usage, examples: this.examples });
    if (action === 'create') {
      header('Creating MineOps Cluster');
      const existing = services.runner.run('k3d', ['cluster', 'list', 'mineops-local'], { capture: true, allowFailure: true });
      if (existing.status === 0 && existing.stdout.includes('mineops-local')) {
        ok('Cluster already exists');
        print('Next: run mineops deploy');
        return;
      }
      const env = services.env.load({ optional: true });
      fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true });
      fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true });
      print('Creating local Kubernetes cluster...');
      services.runner.run('k3d', ['cluster', 'create', '--config', services.paths.k3dConfig()], { quiet: true });
      ok('Cluster created');
      print('Next: run mineops deploy');
      return;
    }
    if (action === 'delete') {
      header('Deleting MineOps Cluster');
      services.runner.run('k3d', ['cluster', 'delete', 'mineops-local'], { allowFailure: true });
      ok('Cluster deleted');
      return;
    }
    if (action === 'recreate') {
      await this.execute({ args: ['delete'], services });
      await this.execute({ args: ['create'], services });
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
