import { resourceNamesFor } from '../domain/resource-names.js';

export class HealthChecker {
  constructor({ kubernetes }) {
    this.kubernetes = kubernetes;
  }

  check(mineopsConfig) {
    const instanceHealth = (mineopsConfig?.instances ?? []).map((instance) => {
      const names = resourceNamesFor(instance);
      const minecraft = this.kubernetes.deploymentState(names.minecraftDeployment, instance);
      const playit = this.kubernetes.playitState(instance);
      const discord = this.kubernetes.deploymentState(names.discordDeployment, instance);
      const backup = this.kubernetes.cronJob(names.backupCronJob, instance);
      return {
        name: instance.name,
        namespace: instance.namespace,
        healthy: minecraft.state === 'ONLINE' && playit.publicReady && discord.state === 'ONLINE' && Boolean(backup),
        minecraft,
        playit,
        discord,
        backupCronJobReady: Boolean(backup),
      };
    });
    const first = instanceHealth[0] ?? {};
    return {
      healthy: instanceHealth.every((item) => item.healthy),
      instances: instanceHealth,
      minecraft: first.minecraft,
      playit: first.playit,
      discord: first.discord,
      backupCronJobReady: first.backupCronJobReady,
    };
  }
}
