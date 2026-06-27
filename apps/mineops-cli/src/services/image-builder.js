import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

function collectFiles(directory, ignored = new Set(['node_modules'])) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(fullPath, ignored));
    else files.push(fullPath);
  }
  return files.sort();
}

export class ImageBuilder {
  constructor({ runner, image, sourcePath, buildContextPath = sourcePath, dockerfilePath = null, fingerprintPaths = [sourcePath], clusterName, statePath }) {
    this.runner = runner;
    this.image = image;
    this.sourcePath = sourcePath;
    this.buildContextPath = buildContextPath;
    this.dockerfilePath = dockerfilePath;
    this.fingerprintPaths = fingerprintPaths;
    this.clusterName = clusterName;
    this.statePath = statePath;
  }

  sourceFingerprint() {
    const hash = crypto.createHash('sha256');
    for (const fingerprintPath of this.fingerprintPaths) {
      for (const file of collectFiles(fingerprintPath)) {
        hash.update(path.relative(this.buildContextPath, file));
        hash.update('\0');
        hash.update(fs.readFileSync(file));
        hash.update('\0');
      }
    }
    return hash.digest('hex');
  }

  storedFingerprint() {
    if (!fs.existsSync(this.statePath)) return null;
    return fs.readFileSync(this.statePath, 'utf8').trim() || null;
  }

  localImageExists() {
    return this.runner.run('docker', ['image', 'inspect', this.image], { capture: true, allowFailure: true }).status === 0;
  }

  buildIfNeeded() {
    const fingerprint = this.sourceFingerprint();
    if (this.localImageExists() && this.storedFingerprint() === fingerprint) {
      return { changed: false, fingerprint, message: 'Discord bot image is unchanged' };
    }

    const args = ['build', '-t', this.image];
    if (this.dockerfilePath) args.push('-f', this.dockerfilePath);
    args.push(this.buildContextPath);
    this.runner.run('docker', args, { quiet: true });
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, `${fingerprint}\n`, 'utf8');
    return { changed: true, fingerprint, message: 'Discord bot image built' };
  }

  clusterNodeNames(clusterName = this.clusterName) {
    const result = this.runner.run('docker', ['ps', '--format', '{{.Names}}'], { capture: true, allowFailure: true });
    return result.stdout.split(/\r?\n/).filter((name) => new RegExp(`^k3d-${clusterName}-(server|agent)-`).test(name));
  }

  imageLoadedInCluster(clusterName = this.clusterName) {
    const nodes = this.clusterNodeNames(clusterName);
    if (nodes.length === 0) return false;
    const imageRef = `docker.io/library/${this.image}`;
    return nodes.every((node) => this.runner.run('docker', ['exec', node, 'crictl', 'images', '-q', imageRef], { capture: true, allowFailure: true }).stdout.trim());
  }

  removeClusterImage(clusterName = this.clusterName) {
    const imageRef = `docker.io/library/${this.image}`;
    for (const node of this.clusterNodeNames(clusterName)) {
      this.runner.run('docker', ['exec', node, 'crictl', 'rmi', imageRef], { quiet: true, allowFailure: true });
    }
  }

  loadIfNeeded({ force = false, clusterName = this.clusterName } = {}) {
    if (!force && this.imageLoadedInCluster(clusterName)) {
      return { changed: false, message: 'Discord bot image already loaded in cluster' };
    }

    if (force) this.removeClusterImage(clusterName);
    this.runner.run('k3d', ['image', 'import', this.image, '-c', clusterName], { quiet: true });
    return { changed: true, message: 'Discord bot image loaded into cluster' };
  }
}
