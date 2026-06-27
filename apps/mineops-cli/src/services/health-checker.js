export class HealthChecker {
  constructor({ kubernetes }) {
    this.kubernetes = kubernetes;
  }

  check(mineopsConfig = null) {
    const instances = mineopsConfig?.instances ?? [{ name: 'default', namespace: this.kubernetes.namespace }];
    const instanceHealth = instances.map((instance) => {
      const minecraft = this.kubernetes.deploymentState('minecraft', instance.namespace);
      const playit = this.kubernetes.playitState(instance.namespace);
      const discord = this.kubernetes.deploymentState('discord-bot', instance.namespace);
      const backup = this.kubernetes.cronJob('minecraft-backup', instance.namespace);
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