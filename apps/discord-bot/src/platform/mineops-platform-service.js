export class MineOpsPlatformService {
  constructor({ statusProvider, playerProvider, stateStore }) {
    this.statusProvider = statusProvider;
    this.playerProvider = playerProvider;
    this.stateStore = stateStore;
  }

  async checkReadiness() {
    return this.statusProvider.getStatus();
  }

  getMaintenance() {
    return this.stateStore?.getMaintenance?.() ?? { enabled: false };
  }

  async getStatus() {
    const [status, server, players] = await Promise.all([
      this.statusProvider.getStatus(),
      this.statusProvider.getServer(),
      this.playerProvider.getPlayers(),
    ]);
    const backup = await this.statusProvider.getBackupInfo();

    return {
      ...status,
      server,
      players,
      backup,
      maintenance: this.getMaintenance(),
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
        maintenance: this.getMaintenance(),
      };
    }

    const players = await this.playerProvider.getPlayers();
    return {
      ...players,
      minecraftRunning: status.running,
      namespace: status.namespace,
      maintenance: this.getMaintenance(),
    };
  }

  async getServer() {
    const [server, backup] = await Promise.all([
      this.statusProvider.getServer(),
      this.statusProvider.getBackupInfo(),
    ]);

    return {
      ...server,
      backup,
      maintenance: this.getMaintenance(),
    };
  }
}
