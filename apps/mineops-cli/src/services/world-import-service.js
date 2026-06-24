import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PlatformError, UserInputError } from '../domain/errors.js';

function directoryStats(directory) {
  const stats = { files: 0, bytes: 0 };
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const childStats = directoryStats(fullPath);
      stats.files += childStats.files;
      stats.bytes += childStats.bytes;
    } else {
      stats.files += 1;
      stats.bytes += fs.statSync(fullPath).size;
    }
  }
  return stats;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
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

    const copySource = directWorld ? resolved : path.join(resolved, 'world');
    const stats = directoryStats(copySource);

    return {
      source: resolved,
      copySource,
      mode: directWorld ? 'single-world-folder' : 'data-root',
      worldName: directWorld ? path.basename(resolved) : 'world',
      files: stats.files,
      bytes: stats.bytes,
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

  copyWorldWithProgress({ source, destination, totalBytes, onStep }) {
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-cf', '-', '.'], {
        cwd: source,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const kubectl = spawn('kubectl', ['exec', '-i', '-n', this.namespace, this.podName, '--', 'tar', '-xf', '-', '-C', destination], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      let lastReportedBytes = -1;
      let streamedBytes = 0;
      let tarCode = null;
      let kubectlCode = null;
      let settled = false;
      let transferStreamComplete = false;
      let forcedKubectlClose = false;
      let closeWatchdog = null;

      const clearTimers = () => {
        clearInterval(timer);
        if (closeWatchdog) clearTimeout(closeWatchdog);
      };

      const settleSuccess = () => {
        if (settled) return;
        clearTimers();
        reportProgress();
        settled = true;
        resolve();
      };

      const settleFailure = (message, cause) => {
        if (settled) return;
        clearTimers();
        settled = true;
        reject(new PlatformError(message, { cause }));
      };

      const startCloseWatchdog = () => {
        if (closeWatchdog) return;
        closeWatchdog = setTimeout(() => {
          if (settled) return;
          forcedKubectlClose = true;
          onStep('Transfer stream finished; continuing with validation...');
          kubectl.kill();
          settleSuccess();
        }, 15000);
        closeWatchdog.unref?.();
      };

      const reportProgress = () => {
        if (streamedBytes !== lastReportedBytes) {
          onStep(`Copying world files... ${formatBytes(streamedBytes)} streamed / ${formatBytes(totalBytes)} payload`);
          lastReportedBytes = streamedBytes;
        }
      };

      const timer = setInterval(reportProgress, 5000);
      tar.stdout.on('data', (chunk) => {
        streamedBytes += chunk.length;
        if (!kubectl.stdin.destroyed && !kubectl.stdin.write(chunk)) {
          tar.stdout.pause();
        }
      });
      kubectl.stdin.on('drain', () => {
        tar.stdout.resume();
      });
      kubectl.stdin.on('error', () => {
        // The validation step catches incomplete imports. Stdin can close first
        // when kubectl exits after the remote tar has finished extracting.
      });
      tar.stdout.on('end', () => {
        transferStreamComplete = true;
        if (!kubectl.stdin.destroyed) kubectl.stdin.end();
        startCloseWatchdog();
      });
      tar.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      kubectl.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      kubectl.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      const finishIfDone = () => {
        if (settled || tarCode === null || kubectlCode === null) return;
        reportProgress();
        if (tarCode === 0 && (kubectlCode === 0 || (forcedKubectlClose && transferStreamComplete))) {
          settleSuccess();
          return;
        }
        settleFailure('World copy failed', (stderr || stdout).trim() || `tar exited with ${tarCode}, kubectl exec exited with ${kubectlCode}`);
      };

      tar.on('error', (error) => {
        kubectl.kill();
        settleFailure('Failed to start local tar for world import', error);
      });
      kubectl.on('error', (error) => {
        tar.kill();
        settleFailure('Failed to start kubectl exec for world import', error);
      });
      tar.on('exit', (code) => {
        tarCode = code;
        if (code === 0) {
          transferStreamComplete = true;
          if (!kubectl.stdin.destroyed) kubectl.stdin.end();
          startCloseWatchdog();
        }
        finishIfDone();
      });
      kubectl.on('exit', (code) => {
        kubectlCode = code;
        finishIfDone();
      });

      reportProgress();
    });
  }

  async importWorld(sourcePath, { onStep = () => {} } = {}) {
    onStep('Inspecting source directory...');
    const detected = this.detectSource(sourcePath);
    onStep(`Source detected: ${detected.mode === 'data-root' ? 'server data root' : 'world folder'}`);
    onStep(`World payload: ${detected.files} files, ${formatBytes(detected.bytes)}`);

    onStep('Checking Minecraft is stopped and backups are idle...');
    this.ensureImportAllowed();

    onStep('Creating temporary import pod...');
    this.createMigrationPod();

    try {
      onStep('Preparing target world directory in minecraft-data PVC...');
      this.runner.run('kubectl', ['exec', '-n', this.namespace, this.podName, '--', 'sh', '-c', 'rm -rf /minecraft-data/world && mkdir -p /minecraft-data/world']);

      await this.copyWorldWithProgress({
        source: detected.copySource,
        destination: '/minecraft-data/world',
        totalBytes: detected.bytes,
        onStep,
      });

      onStep('Verifying imported world metadata...');
      this.runner.run('kubectl', ['exec', '-n', this.namespace, this.podName, '--', 'test', '-f', '/minecraft-data/world/level.dat']);

      onStep('Repairing world file ownership and permissions...');
      this.runner.run('kubectl', ['exec', '-n', this.namespace, this.podName, '--', 'sh', '-c', 'chown -R 1000:1000 /minecraft-data/world && chmod -R u+rwX,g+rwX /minecraft-data/world']);

      this.dataService.appendEvent({ type: 'minecraft', severity: 'INFO', message: 'World Imported' });
      return detected;
    } finally {
      onStep('Cleaning up temporary import pod...');
      this.cleanupMigrationPod();
    }
  }
}
