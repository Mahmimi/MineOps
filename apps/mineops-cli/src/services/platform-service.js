import { age, durationSince } from './time.js';
import { resourceNamesFor } from '../domain/resource-names.js';

export class PlatformService {
  constructor({ kubernetes, runner, backupService, dataService, deploymentManager, getMineOpsConfig }) {
    this.kubernetes = kubernetes;
    this.runner = runner;
    this.backupService = backupService;
    this.dataService = dataService;
    this.deploymentManager = deploymentManager;
    this.getMineOpsConfig = getMineOpsConfig;
  }

  snapshot(instance) {
    const names = resourceNamesFor(instance);
    const minecraft = this.kubernetes.deploymentState(names.minecraftDeployment, instance);
    const discord = this.kubernetes.deploymentState(names.discordDeployment, instance);
    const playit = this.kubernetes.playitState(instance);
    const nodes = this.kubernetes.nodes();
    const pod = this.kubernetes.podFor(names.minecraftSelector, instance);
    const players = this.queryPlayers(instance);
    const backup = this.backupService.latestJob(instance);
    const backupConfig = this.backupService.config(instance);
    const pvc = this.kubernetes.pvc(names.minecraftPvc, instance);
    const maintenance = this.dataService.maintenance(instance);
    const alerts = this.dataService.activeAlerts(instance);
    return { instance, minecraft, discord, playit, nodes, pod, players, backup, backupConfig, pvc, maintenance, alerts };
  }

  queryPlayers(instance) {
    const names = resourceNamesFor(instance);
    const code = "import { loadConfig } from './src/config.js'; import { createLogger } from './src/logger.js'; import { KubernetesStatusProvider } from './src/platform/kubernetes-status-provider.js'; import { MinecraftQueryProvider } from './src/platform/minecraft-query-provider.js'; import { MineOpsPlatformService } from './src/platform/mineops-platform-service.js'; import { PlatformStateStore } from './src/platform/platform-state-store.js'; const config = loadConfig(); const logger = createLogger({ serviceName: 'mineops-cli', level: 'error' }); const stateStore = new PlatformStateStore({ logger }); const service = new MineOpsPlatformService({ statusProvider: new KubernetesStatusProvider({ config, logger }), playerProvider: new MinecraftQueryProvider({ config, logger }), stateStore }); console.log(JSON.stringify(await service.getPlayers()));";
    const result = this.runner.run('kubectl', ['exec', '-n', instance.namespace, `deployment/${names.discordDeployment}`, '--', 'node', '--input-type=module', '-e', code], { capture: true, allowFailure: true });
    if (result.status !== 0) return null;
    try { return JSON.parse(result.stdout.trim()); } catch { return null; }
  }

  terraformClean(instance, mineopsConfig = this.getMineOpsConfig()) {
    const workdir = this.deploymentManager.terraformWorkdir(mineopsConfig, instance);
    return this.deploymentManager.terraformPlanClean(workdir);
  }

  health(instance) {
    const s = this.snapshot(instance);
    const backupHealthy = s.backup?.complete && !s.backup?.failed;
    return {
      minecraft: s.minecraft.state === 'ONLINE',
      discord: s.discord.state === 'ONLINE',
      playit: s.playit.publicReady,
      backups: Boolean(backupHealthy),
      cluster: s.nodes.length > 0,
      maintenance: s.maintenance.enabled === true,
      uptime: durationSince(s.pod?.status?.startTime),
      backupAge: age(s.backup?.completionTime),
    };
  }
}
