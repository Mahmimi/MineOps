#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry } from './commands/registry.js';
import { PlatformError, UserInputError } from './domain/errors.js';
import { EnvProvider } from './infrastructure/env-provider.js';
import { KubernetesAdapter } from './infrastructure/kubernetes-adapter.js';
import { ProcessRunner } from './infrastructure/process-runner.js';
import { BackupService } from './services/backup-service.js';
import { ConfigService } from './services/config-service.js';
import { DataService } from './services/data-service.js';
import { OperationService } from './services/operation-service.js';
import { PlatformService } from './services/platform-service.js';
import { WorldImportService } from './services/world-import-service.js';
import * as time from './services/time.js';
import { fail, print, usage } from './ui/printer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..', '..');
const constants = {
  root,
  namespace: 'mineops',
  cluster: 'mineops-local',
  version: '1.0.0',
  botImage: 'mineops-discord-bot:v1.0.0',
};

const paths = {
  root: () => root,
  script: (name) => path.join(root, 'scripts', name),
  terraform: () => path.join(root, 'infra', 'terraform'),
  k3dConfig: () => path.join(root, 'infra', 'k3d', 'local.yaml'),
  discordBot: () => path.join(root, 'apps', 'discord-bot'),
  discordManifests: () => path.join(root, 'platform', 'kubernetes', 'discord-bot'),
};

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function createServices() {
  const env = new EnvProvider({ root });
  const runner = new ProcessRunner({ cwd: root, envProvider: env });
  const kubernetes = new KubernetesAdapter({ runner, namespace: constants.namespace });
  const data = new DataService({ runner, namespace: constants.namespace });
  const backups = new BackupService({ root, kubernetes });
  const config = new ConfigService({ root, kubernetes, dataService: data, runner });
  const platform = new PlatformService({ kubernetes, runner, backupService: backups, dataService: data });
  const operations = new OperationService({ runner, namespace: constants.namespace, dataService: data });
  const worldImport = new WorldImportService({ runner, kubernetes, dataService: data, namespace: constants.namespace });
  return {
    env,
    runner,
    kubernetes,
    data,
    backups,
    config,
    platform,
    operations,
    worldImport,
    paths,
    time,
    format: { bytes: formatBytes },
  };
}

function logError(error) {
  try {
    const logPath = path.join(root, '.mineops', 'mineops-cli.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const details = [
      `[${new Date().toISOString()}] ${error.stack ?? error.message}`,
      error.cause ? `Cause:\n${error.cause}` : null,
    ].filter(Boolean).join('\n');
    fs.appendFileSync(logPath, `${details}\n`, 'utf8');
  } catch {
    // Avoid secondary errors in the user path.
  }
}

async function main() {
  const registry = createRegistry();
  const [commandName = 'help', ...args] = process.argv.slice(2);
  const command = registry.get(commandName);

  if (!command) {
    fail('Invalid command');
    print('');
    print('Use:');
    print('mineops help');
    process.exitCode = 1;
    return;
  }

  if (args.includes('--help')) {
    usage(command);
    return;
  }

  try {
    await command.execute({ args, services: createServices(), constants, registry });
  } catch (error) {
    if (error instanceof UserInputError) {
      fail(error.message);
      print('');
      if (error.usage) {
        print('Usage:');
        print(error.usage);
      }
      if (error.examples?.length) {
        print('');
        print('Examples:');
        for (const example of error.examples) print(example);
      }
      process.exitCode = 1;
      return;
    }

    if (error instanceof PlatformError) {
      logError(error);
      fail(error.message);
      print('');
      print('Use:');
      print('mineops doctor');
      process.exitCode = 1;
      return;
    }

    logError(error);
    fail('Unexpected platform error');
    print('');
    print('Use:');
    print('mineops doctor');
    process.exitCode = 1;
  }
}

await main();
