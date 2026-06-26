export class HealthChecker {
  constructor({ kubernetes }) {
    this.kubernetes = kubernetes;
  }

  check() {
    const minecraft = this.kubernetes.deploymentState('minecraft');
    const playit = this.kubernetes.playitState();
    const discord = this.kubernetes.deploymentState('discord-bot');
    const backup = this.kubernetes.cronJob('minecraft-backup');

    return {
      healthy: minecraft.state === 'ONLINE' && playit.publicReady && discord.state === 'ONLINE' && Boolean(backup),
      minecraft,
      playit,
      discord,
      backupCronJobReady: Boolean(backup),
    };
  }
}
