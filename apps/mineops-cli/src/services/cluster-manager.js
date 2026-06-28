import fs from 'node:fs';
import path from 'node:path';

export class ClusterManager {
  constructor({ runner, clusterName, k3dConfigPath, generatedRoot }) {
    this.runner = runner;
    this.clusterName = clusterName;
    this.k3dConfigPath = k3dConfigPath;
    this.generatedRoot = generatedRoot;
  }

  exists(clusterName = this.clusterName) {
    const result = this.runner.run('k3d', ['cluster', 'list', clusterName], { capture: true, allowFailure: true });
    return result.status === 0 && result.stdout.includes(clusterName);
  }

  configFor(clusterName = this.clusterName) {
    if (!this.generatedRoot || clusterName === this.clusterName) return this.k3dConfigPath;

    const generatedDir = path.join(this.generatedRoot, 'k3d');
    fs.mkdirSync(generatedDir, { recursive: true });
    const targetPath = path.join(generatedDir, `${clusterName}.yaml`);
    const source = fs.readFileSync(this.k3dConfigPath, 'utf8');
    const rendered = source.replace(/(metadata:\s*\r?\n\s*name:\s*)[^\r\n]+/, `$1${clusterName}`);
    fs.writeFileSync(targetPath, rendered, 'utf8');
    return targetPath;
  }

  ensure({ env, clusterName = this.clusterName }) {
    fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true });
    fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true });

    if (this.exists(clusterName)) {
      return { changed: false, message: 'Cluster already exists' };
    }

    this.runner.run('k3d', ['cluster', 'create', '--config', this.configFor(clusterName)], { quiet: true });
    return { changed: true, message: 'Cluster created' };
  }
}