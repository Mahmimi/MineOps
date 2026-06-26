import fs from 'node:fs';

export class ClusterManager {
  constructor({ runner, clusterName, k3dConfigPath }) {
    this.runner = runner;
    this.clusterName = clusterName;
    this.k3dConfigPath = k3dConfigPath;
  }

  exists() {
    const result = this.runner.run('k3d', ['cluster', 'list', this.clusterName], { capture: true, allowFailure: true });
    return result.status === 0 && result.stdout.includes(this.clusterName);
  }

  ensure({ env }) {
    fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true });
    fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true });

    if (this.exists()) {
      return { changed: false, message: 'Cluster already exists' };
    }

    this.runner.run('k3d', ['cluster', 'create', '--config', this.k3dConfigPath], { quiet: true });
    return { changed: true, message: 'Cluster created' };
  }
}
