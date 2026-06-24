import { age, durationSince } from './time.js';

export class PlatformService {
  constructor({ kubernetes, runner, backupService, dataService }) {
    this.kubernetes = kubernetes;
    this.runner = runner;
    this.backupService = backupService;
    this.dataService = dataService;
  }

  snapshot() {
    const minecraft = this.kubernetes.deploymentState('minecraft');
    const discord = this.kubernetes.deploymentState('discord-bot');
    const playit = this.kubernetes.playitState();
    const nodes = this.kubernetes.nodes();
    const pod = this.kubernetes.podFor('app.kubernetes.io/name=minecraft');
    const players = this.queryPlayers();
    const backup = this.backupService.latestJob();
    const backupConfig = this.backupService.config();
    const pvc = this.kubernetes.pvc('minecraft-data');
    const maintenance = this.dataService.maintenance();
    const alerts = this.dataService.activeAlerts();
    return { minecraft, discord, playit, nodes, pod, players, backup, backupConfig, pvc, maintenance, alerts };
  }

  queryPlayers() {
    const code = "import { loadConfig } from './src/config.js'; import { createLogger } from './src/logger.js'; import { KubernetesStatusProvider } from './src/platform/kubernetes-status-provider.js'; import { MinecraftQueryProvider } from './src/platform/minecraft-query-provider.js'; import { MineOpsPlatformService } from './src/platform/mineops-platform-service.js'; import { PlatformStateStore } from './src/platform/platform-state-store.js'; const config = loadConfig(); const logger = createLogger({ serviceName: 'mineops-cli', level: 'error' }); const stateStore = new PlatformStateStore({ logger }); const service = new MineOpsPlatformService({ statusProvider: new KubernetesStatusProvider({ config, logger }), playerProvider: new MinecraftQueryProvider({ config, logger }), stateStore }); console.log(JSON.stringify(await service.getPlayers()));";
    const result = this.runner.run('kubectl', ['exec', '-n', 'mineops', 'deployment/discord-bot', '--', 'node', '--input-type=module', '-e', code], { capture: true, allowFailure: true });
    if (result.status !== 0) return null;
    try { return JSON.parse(result.stdout.trim()); } catch { return null; }
  }

  terraformClean() {
    return this.runner.run('terraform', ['plan', '-detailed-exitcode'], { cwd: this.runner.cwd + '/infra/terraform', capture: true, allowFailure: true }).status === 0;
  }

  health() {
    const s = this.snapshot();
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
