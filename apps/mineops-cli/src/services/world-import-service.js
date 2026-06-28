import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PlatformError, UserInputError } from '../domain/errors.js';
import { resourceNamesFor } from '../domain/resource-names.js';

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
  constructor({ runner, kubernetes, dataService, operations }) {
    this.runner = runner;
    this.kubernetes = kubernetes;
    this.dataService = dataService;
    this.operations = operations;
  }

  detectSource(sourcePath) {
    const resolved = path.resolve(sourcePath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw new UserInputError('World import source must be an existing directory', {
        usage: 'mineops import --instance <name> --source <path>',
        examples: ['mineops import --instance survival --source migrate/mineops-minecraft-data-old'],
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
        examples: ['mineops import --instance survival --source migrate/mineops-minecraft-data-old'],
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

  ensureImportAllowed(instance) {
    const runningBackup = this.kubernetes.backupJobs(instance).some((job) => (job.status?.active ?? 0) > 0);
    if (runningBackup) {
      throw new UserInputError('A backup is currently running. Try again later.', {
        usage: 'mineops import --instance <name> --source <path>',
      });
    }
  }

  createMigrationPod(instance) {
    const names = resourceNamesFor(instance);
    const overrides = JSON.stringify({
      spec: {
        containers: [{
          name: names.worldImportPod,
          image: 'busybox:1.36',
          command: ['sh', '-c', 'sleep 3600'],
          volumeMounts: [{ name: names.minecraftPvc, mountPath: '/minecraft-data' }],
        }],
        volumes: [{
          name: names.minecraftPvc,
          persistentVolumeClaim: { claimName: names.minecraftPvc },
        }],
        restartPolicy: 'Never',
      },
    });

    this.runner.run('kubectl', ['delete', 'pod', names.worldImportPod, '-n', instance.namespace, '--ignore-not-found=true'], { allowFailure: true });
    this.runner.run('kubectl', ['run', names.worldImportPod, '-n', instance.namespace, '--image=busybox:1.36', '--restart=Never', `--overrides=${overrides}`, '--command', '--', 'sh', '-c', 'sleep 3600']);
    this.runner.run('kubectl', ['wait', '--for=condition=Ready', `pod/${names.worldImportPod}`, '-n', instance.namespace, '--timeout=120s']);
  }

  cleanupMigrationPod(instance) {
    const names = resourceNamesFor(instance);
    this.runner.run('kubectl', ['delete', 'pod', names.worldImportPod, '-n', instance.namespace, '--ignore-not-found=true'], { allowFailure: true });
  }

  copyWorldWithProgress(instance, { source, destination, totalBytes, onStep }) {
    const names = resourceNamesFor(instance);
    return new Promise((resolve, reject) => {
      const tar = spawn('tar', ['-cf', '-', '.'], {
        cwd: source,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const kubectl = spawn('kubectl', ['exec', '-i', '-n', instance.namespace, names.worldImportPod, '--', 'tar', '-xf', '-', '-C', destination], {
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
      kubectl.stdin.on('error', () => {});
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

  async importWorld(instance, sourcePath, { onStep = () => {} } = {}) {
    const names = resourceNamesFor(instance);
    onStep('Inspecting source directory...');
    const detected = this.detectSource(sourcePath);
    onStep(`Source detected: ${detected.mode === 'data-root' ? 'server data root' : 'world folder'}`);
    onStep(`World payload: ${detected.files} files, ${formatBytes(detected.bytes)}`);

    onStep('Checking backup activity...');
    this.ensureImportAllowed(instance);

    let minecraftRestarted = false;
    onStep('Stopping Minecraft...');
    this.operations.scale(instance, names.minecraftDeployment, 0);

    onStep('Creating temporary import pod...');
    this.createMigrationPod(instance);

    try {
      onStep('Preparing target world directory in PVC...');
      this.runner.run('kubectl', ['exec', '-n', instance.namespace, names.worldImportPod, '--', 'sh', '-c', 'rm -rf /minecraft-data/world && mkdir -p /minecraft-data/world']);

      await this.copyWorldWithProgress(instance, {
        source: detected.copySource,
        destination: '/minecraft-data/world',
        totalBytes: detected.bytes,
        onStep,
      });

      onStep('Verifying imported world metadata...');
      this.runner.run('kubectl', ['exec', '-n', instance.namespace, names.worldImportPod, '--', 'test', '-f', '/minecraft-data/world/level.dat']);

      onStep('Repairing world file ownership and permissions...');
      this.runner.run('kubectl', ['exec', '-n', instance.namespace, names.worldImportPod, '--', 'sh', '-c', 'chown -R 1000:1000 /minecraft-data/world && chmod -R u+rwX,g+rwX /minecraft-data/world']);

      onStep('Starting Minecraft...');
      this.operations.scale(instance, names.minecraftDeployment, 1);
      minecraftRestarted = true;

      onStep('Verifying running world...');
      const pod = this.kubernetes.podFor(names.minecraftSelector, instance);
      if (pod?.metadata?.name) {
        this.runner.run('kubectl', ['exec', '-n', instance.namespace, pod.metadata.name, '--', 'sh', '-lc', 'test -d /data/world && test -f /data/world/level.dat']);
      }

      this.dataService.appendEvent(instance, { type: 'minecraft', severity: 'INFO', message: 'World Imported' });
      return detected;
    } catch (error) {
      if (!minecraftRestarted) {
        onStep('Import failed before restart; attempting safe recovery...');
        this.operations.scale(instance, names.minecraftDeployment, 1);
      }
      throw error;
    } finally {
      onStep('Cleaning up temporary import pod...');
      this.cleanupMigrationPod(instance);
    }
  }
}
