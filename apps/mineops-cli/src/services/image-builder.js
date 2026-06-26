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
  constructor({ runner, image, sourcePath, clusterName, statePath }) {
    this.runner = runner;
    this.image = image;
    this.sourcePath = sourcePath;
    this.clusterName = clusterName;
    this.statePath = statePath;
  }

  sourceFingerprint() {
    const hash = crypto.createHash('sha256');
    for (const file of collectFiles(this.sourcePath)) {
      hash.update(path.relative(this.sourcePath, file));
      hash.update('\0');
      hash.update(fs.readFileSync(file));
      hash.update('\0');
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

    this.runner.run('docker', ['build', '-t', this.image, this.sourcePath], { quiet: true });
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, `${fingerprint}\n`, 'utf8');
    return { changed: true, fingerprint, message: 'Discord bot image built' };
  }

  clusterNodeNames() {
    const result = this.runner.run('docker', ['ps', '--format', '{{.Names}}'], { capture: true, allowFailure: true });
    return result.stdout.split(/\r?\n/).filter((name) => new RegExp(`^k3d-${this.clusterName}-(server|agent)-`).test(name));
  }

  imageLoadedInCluster() {
    const nodes = this.clusterNodeNames();
    if (nodes.length === 0) return false;
    const imageRef = `docker.io/library/${this.image}`;
    return nodes.every((node) => this.runner.run('docker', ['exec', node, 'crictl', 'images', '-q', imageRef], { capture: true, allowFailure: true }).stdout.trim());
  }

  removeClusterImage() {
    const imageRef = `docker.io/library/${this.image}`;
    for (const node of this.clusterNodeNames()) {
      this.runner.run('docker', ['exec', node, 'crictl', 'rmi', imageRef], { quiet: true, allowFailure: true });
    }
  }

  loadIfNeeded({ force = false } = {}) {
    if (!force && this.imageLoadedInCluster()) {
      return { changed: false, message: 'Discord bot image already loaded in cluster' };
    }

    if (force) this.removeClusterImage();
    this.runner.run('k3d', ['image', 'import', this.image, '-c', this.clusterName], { quiet: true });
    return { changed: true, message: 'Discord bot image loaded into cluster' };
  }
}
