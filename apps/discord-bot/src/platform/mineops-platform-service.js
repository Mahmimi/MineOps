export class MineOpsPlatformService {
  constructor({ statusProvider, playerProvider }) {
    this.statusProvider = statusProvider;
    this.playerProvider = playerProvider;
  }

  async checkReadiness() {
    return this.statusProvider.getStatus();
  }

  async getStatus() {
    const [status, server, players] = await Promise.all([
      this.statusProvider.getStatus(),
      this.statusProvider.getServer(),
      this.playerProvider.getPlayers(),
    ]);

    return {
      ...status,
      server,
      players,
    };
  }

  async getPlayers() {
    const status = await this.statusProvider.getStatus();

    if (!status.running) {
      return {
        available: false,
        onlineCount: null,
        maxPlayers: null,
        players: [],
        reason: 'Minecraft is not currently running.',
        minecraftRunning: false,
        namespace: status.namespace,
        source: 'minecraft-query-protocol',
      };
    }

    const players = await this.playerProvider.getPlayers();
    return {
      ...players,
      minecraftRunning: status.running,
      namespace: status.namespace,
    };
  }

  async getServer() {
    return this.statusProvider.getServer();
  }
}
