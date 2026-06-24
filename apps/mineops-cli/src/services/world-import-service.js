import fs from 'node:fs';
import path from 'node:path';
import { UserInputError } from '../domain/errors.js';

function countFiles(directory) {
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) count += countFiles(fullPath);
    else count += 1;
  }
  return count;
}

export class WorldImportService {
  constructor({ runner, kubernetes, dataService, namespace }) {
    this.runner = runner;
    this.kubernetes = kubernetes;
    this.dataService = dataService;
    this.namespace = namespace;
    this.podName = 'mineops-world-import';
  }

  detectSource(sourcePath) {
    const resolved = path.resolve(sourcePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new UserInputError('World import source must be an existing directory', {
        usage: 'mineops import world <path>',
        examples: ['mineops import world "D:\\minecraft-server\\data"'],
      });
    }

    const directRegion =
      fs.existsSync(path.join(resolved, 'region')) ||
      fs.existsSync(path.join(resolved, 'dimensions', 'minecraft', 'overworld', 'region'));
    const nestedRegion =
      fs.existsSync(path.join(resolved, 'world', 'region')) ||
      fs.existsSync(path.join(resolved, 'world', 'dimensions', 'minecraft', 'overworld', 'region'));
    const directWorld = fs.existsSync(path.join(resolved, 'level.dat')) && directRegion;
    const nestedWorld = fs.existsSync(path.join(resolved, 'world', 'level.dat')) && nestedRegion;
    if (!directWorld && !nestedWorld) {
      throw new UserInputError('Source does not look like Minecraft world data', {
        usage: 'Expected either <path>\\world\\level.dat or <path>\\level.dat with region folder.',
        examples: ['mineops import world "D:\\minecraft-server\\data"'],
      });
    }

    return {
      source: resolved,
      mode: directWorld ? 'single-world-folder' : 'data-root',
      worldName: directWorld ? path.basename(resolved) : 'world',
      files: countFiles(resolved),
    };
  }

  ensureImportAllowed() {
    const state = this.kubernetes.deploymentState('minecraft');
    if (state.state !== 'SCALED TO 0') {
      throw new UserInputError('Minecraft must be stopped before importing world data', {
        usage: 'mineops stop minecraft\nmineops import world <path>',
        examples: ['mineops stop minecraft', 'mineops import world "D:\\minecraft-server\\data"'],
      });
    }
    const runningBackup = this.kubernetes.backupJobs().some((job) => (job.status?.active ?? 0) > 0);
    if (runningBackup) {
      throw new UserInputError('A backup is currently running. Try again later.', {
        usage: 'mineops import world <path>',
      });
    }
  }

  createMigrationPod() {
    const overrides = JSON.stringify({
      spec: {
        containers: [{
          name: this.podName,
          image: 'busybox:1.36',
          command: ['sh', '-c', 'sleep 3600'],
          volumeMounts: [{ name: 'minecraft-data', mountPath: '/minecraft-data' }],
        }],
        volumes: [{
          name: 'minecraft-data',
          persistentVolumeClaim: { claimName: 'minecraft-data' },
        }],
        restartPolicy: 'Never',
      },
    });

    this.runner.run('kubectl', ['delete', 'pod', this.podName, '-n', this.namespace, '--ignore-not-found=true'], { allowFailure: true });
    this.runner.run('kubectl', ['run', this.podName, '-n', this.namespace, '--image=busybox:1.36', '--restart=Never', `--overrides=${overrides}`, '--command', '--', 'sh', '-c', 'sleep 3600']);
    this.runner.run('kubectl', ['wait', '--for=condition=Ready', `pod/${this.podName}`, '-n', this.namespace, '--timeout=120s']);
  }

  cleanupMigrationPod() {
    this.runner.run('kubectl', ['delete', 'pod', this.podName, '-n', this.namespace, '--ignore-not-found=true'], { allowFailure: true });
  }

  importWorld(sourcePath) {
    const detected = this.detectSource(sourcePath);
    this.ensureImportAllowed();
    this.createMigrationPod();

    try {
      if (detected.mode === 'single-world-folder') {
        this.runner.run('kubectl', ['exec', '-n', this.namespace, this.podName, '--', 'mkdir', '-p', '/minecraft-data/world']);
        this.runner.run('kubectl', ['cp', '.', `${this.namespace}/${this.podName}:/minecraft-data/world`], { cwd: detected.source });
      } else {
        this.runner.run('kubectl', ['cp', '.', `${this.namespace}/${this.podName}:/minecraft-data`], { cwd: detected.source });
      }
      this.runner.run('kubectl', ['exec', '-n', this.namespace, this.podName, '--', 'test', '-f', '/minecraft-data/world/level.dat']);
      this.dataService.appendEvent({ type: 'minecraft', severity: 'INFO', message: 'World Imported' });
      return detected;
    } finally {
      this.cleanupMigrationPod();
    }
  }
}
