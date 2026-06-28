#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRegistry } from './commands/registry.js';
import { InstanceResolver } from './application/instance-resolver.js';
import { LegacyConfigAdapter } from './config/adapters/legacy-config-adapter.js';
import { MineOpsYamlAdapter } from './config/adapters/mineops-yaml-adapter.js';
import { loadMineOpsConfig } from './config/load-mineops-config.js';
import { PlatformError, UserInputError } from './domain/errors.js';
import { resourceNamesFor } from './domain/resource-names.js';
import { localTimestamp } from '../../utils/time.js';
import { EnvProvider } from './infrastructure/env-provider.js';
import { KubernetesAdapter } from './infrastructure/kubernetes-adapter.js';
import { ProcessRunner } from './infrastructure/process-runner.js';
import { BackupService } from './services/backup-service.js';
import { ClusterManager } from './services/cluster-manager.js';
import { ConfigService } from './services/config-service.js';
import { DataService } from './services/data-service.js';
import { DeploymentManager } from './services/deployment-manager.js';
import { DeploymentOrchestrator } from './services/deployment-orchestrator.js';
import { EnvironmentManager } from './services/environment-manager.js';
import { HealthChecker } from './services/health-checker.js';
import { ImageBuilder } from './services/image-builder.js';
import { OperationService } from './services/operation-service.js';
import { PlatformService } from './services/platform-service.js';
import { RequirementValidator } from './services/requirement-validator.js';
import { WorldImportService } from './services/world-import-service.js';
import * as time from './services/time.js';
import { fail, print, usage } from './ui/printer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..', '..');
const constants = {
  root,
  cluster: process.env.MINEOPS_CLUSTER_NAME || 'mineops-local',
  version: '1.0.0',
  botImage: 'mineops-discord-bot:v1.0.0',
};

const paths = {
  root: () => root,
  script: (name) => path.join(root, 'scripts', name),
  terraform: () => path.join(root, 'infra', 'terraform'),
  k3dConfig: () => process.env.MINEOPS_K3D_CONFIG_PATH || path.join(root, 'infra', 'k3d', 'local.yaml'),
  apps: () => path.join(root, 'apps'),
  discordBot: () => path.join(root, 'apps', 'discord-bot'),
  sharedUtils: () => path.join(root, 'apps', 'utils'),
  discordManifests: () => path.join(root, 'platform', 'kubernetes', 'discord-bot'),
  imageFingerprint: () => path.join(root, '.mineops', 'discord-bot-image.sha256'),
  runtimeFingerprint: () => path.join(root, '.mineops', 'runtime-config.sha256'),
  runtimeConfigArtifact: () => path.join(root, '.mineops', 'runtime', 'runtime-config.json'),
  generated: () => path.join(root, '.mineops'),
};

function formatBytes(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function createServices() {
  const env = new EnvProvider({ root });
  const configPath = process.env.MINEOPS_CONFIG_PATH || path.join(root, 'mineops.yaml');
  const legacyConfigAdapter = new LegacyConfigAdapter({
    root,
    clusterName: constants.cluster,
    envPath: env.envPath,
  });
  const yamlConfigAdapter = new MineOpsYamlAdapter({
    root,
    configPath,
    envPath: env.envPath,
  });
  const configAdapter = yamlConfigAdapter.detect() ? yamlConfigAdapter : legacyConfigAdapter;
  const runner = new ProcessRunner({ cwd: root });

  let cachedMineOpsConfig = null;
  const loadConfig = () => {
    if (!cachedMineOpsConfig) {
      cachedMineOpsConfig = loadMineOpsConfig({ adapter: configAdapter });
      runner.setBaseEnv(cachedMineOpsConfig.globals.env);
    }
    return cachedMineOpsConfig;
  };

  const instanceResolver = new InstanceResolver({ loadMineOpsConfig: loadConfig });
  const kubernetes = new KubernetesAdapter({ runner });
  const data = new DataService({ runner });
  const backups = new BackupService({ root, kubernetes, getMineOpsConfig: loadConfig });
  const requirementValidator = new RequirementValidator({ runner });
  const clusterManager = new ClusterManager({ runner, clusterName: constants.cluster, k3dConfigPath: paths.k3dConfig(), generatedRoot: paths.generated() });
  const environmentManager = new EnvironmentManager({
    runner,
    scriptPath: paths.script('bootstrap-secrets.ps1'),
    statePath: paths.runtimeFingerprint(),
    runtimeConfigPath: paths.runtimeConfigArtifact(),
  });
  const imageBuilder = new ImageBuilder({
    runner,
    image: constants.botImage,
    sourcePath: paths.discordBot(),
    buildContextPath: paths.apps(),
    dockerfilePath: path.join(paths.discordBot(), 'Dockerfile'),
    fingerprintPaths: [paths.discordBot(), paths.sharedUtils()],
    clusterName: constants.cluster,
    statePath: paths.imageFingerprint(),
  });
  const deploymentManager = new DeploymentManager({
    runner,
    terraformPath: paths.terraform(),
    manifestsPath: paths.discordManifests(),
    generatedRoot: paths.generated(),
    botImage: constants.botImage,
  });
  const config = new ConfigService({
    configPath,
    kubernetes,
    runner,
    getMineOpsConfig: loadConfig,
  });
  const operations = new OperationService({ runner, dataService: data });
  const worldImport = new WorldImportService({ runner, kubernetes, dataService: data, operations });
  const healthChecker = new HealthChecker({ kubernetes });
  const platform = new PlatformService({ kubernetes, runner, backupService: backups, dataService: data, deploymentManager, getMineOpsConfig: loadConfig });
  const deployment = new DeploymentOrchestrator({
    requirementValidator,
    clusterManager,
    environmentManager,
    imageBuilder,
    deploymentManager,
    healthChecker,
    dataService: {
      appendEvent: (event) => {
        const mineopsConfig = loadConfig();
        const instance = mineopsConfig.defaultInstance();
        if (instance) data.appendEvent(instance, event);
      },
    },
  });

  function bindInstance(instance) {
    const names = resourceNamesFor(instance);
    return {
      instance,
      names,
      kubernetes: {
        deploymentState: (name) => kubernetes.deploymentState(name, instance),
        playitState: () => kubernetes.playitState(instance),
        podFor: (selector) => kubernetes.podFor(selector, instance),
        pvc: (name) => kubernetes.pvc(name, instance),
        cronJob: (name) => kubernetes.cronJob(name, instance),
        backupJobs: () => kubernetes.backupJobs(instance),
      },
      data: {
        events: () => data.events(instance),
        alerts: () => data.alerts(instance),
        activeAlerts: () => data.activeAlerts(instance),
        appendEvent: (event) => data.appendEvent(instance, event),
        appendAlert: (alert) => data.appendAlert(instance, alert),
        maintenance: () => data.maintenance(instance),
        setMaintenance: (enabled, reason) => data.setMaintenance(instance, enabled, reason),
      },
      backups: {
        jobs: () => backups.jobs(instance),
        latestJob: () => backups.latestJob(instance),
        config: () => backups.config(instance),
        listBackups: () => backups.listBackups(instance),
        backupRoot: () => backups.backupRoot(instance),
      },
      config: {
        readRaw: () => config.readRaw(),
        parse: () => config.parse(instance),
        validate: () => config.validate(instance),
        runtimeDiff: () => config.runtimeDiff(instance),
        worldMetadataWarnings: () => config.worldMetadataWarnings(instance),
        setMinecraftVersion: (version) => config.setMinecraftVersion(instance, version),
      },
      platform: {
        snapshot: () => platform.snapshot(instance),
        health: () => platform.health(instance),
        terraformClean: (mineopsConfig) => platform.terraformClean(instance, mineopsConfig),
      },
      operations: {
        scale: (name, replicas) => operations.scale(instance, name, replicas),
        restart: (target) => operations.restart(instance, target),
        setMinecraftVersion: (version) => operations.setMinecraftVersion(instance, version),
      },
      worldImport: {
        importWorld: (sourcePath, options) => worldImport.importWorld(instance, sourcePath, options),
      },
    };
  }

  return {
    env,
    loadMineOpsConfig: loadConfig,
    resolveTargets: (args, options) => {
      const resolved = instanceResolver.resolveTargets(args, options);
      return { ...resolved, bindings: resolved.targets.map((instance) => bindInstance(instance)) };
    },
    forInstance: bindInstance,
    runner,
    kubernetes,
    data,
    backups,
    config,
    platform,
    operations,
    worldImport,
    clusterManager,
    deploymentManager,
    deployment,
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
      `[${localTimestamp()}] ${error.stack ?? error.message}`,
      error.cause ? `Cause:\n${error.cause}` : null,
    ].filter(Boolean).join('\n');
    fs.appendFileSync(logPath, `${details}\n`, 'utf8');
  } catch {
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
