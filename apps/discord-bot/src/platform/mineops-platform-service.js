export class MineOpsPlatformService {
  constructor({ statusProvider, playerProvider, stateStore, lifecycleService, adminAuthorizationService }) {
    this.statusProvider = statusProvider;
    this.playerProvider = playerProvider;
    this.stateStore = stateStore;
    this.lifecycleService = lifecycleService;
    this.adminAuthorizationService = adminAuthorizationService;
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
    const [server, backup, playit] = await Promise.all([
      this.statusProvider.getServer(),
      this.statusProvider.getBackupInfo(),
      this.statusProvider.getPlayitStatus(),
    ]);

    return {
      ...server,
      backup,
      playit,
      maintenance: this.getMaintenance(),
    };
  }

  async getDashboard() {
    return this.getStatus();
  }

  async getPlayit() {
    const [playit, status] = await Promise.all([
      this.statusProvider.getPlayitStatus(),
      this.statusProvider.getStatus(),
    ]);
    return {
      ...playit,
      minecraftRunning: status.running,
      maintenance: this.getMaintenance(),
    };
  }

  async getBackups() {
    const backup = await this.statusProvider.getBackupInfo();
    return {
      ...backup,
      maintenance: this.getMaintenance(),
    };
  }

  async getEvents({ limit = 5, type } = {}) {
    return this.stateStore?.queryEvents?.({ limit, type }) ?? [];
  }

  async getAlerts({ limit = 5, activeOnly = false } = {}) {
    return this.stateStore?.queryAlerts?.({ limit, activeOnly }) ?? [];
  }

  async startServer({ user }) {
    return this.lifecycleService.startServer({ actor: user?.username ?? user?.id ?? 'Discord user' });
  }

  async stopServer({ user }) {
    this.adminAuthorizationService.requireAdmin(user);
    return this.lifecycleService.stopServer({ actor: user?.username ?? user?.id ?? 'MineOps admin' });
  }

  async restartServer({ user }) {
    this.adminAuthorizationService.requireAdmin(user);
    return this.lifecycleService.restartServer({ actor: user?.username ?? user?.id ?? 'MineOps admin' });
  }

  startIdleMonitor() {
    return this.lifecycleService.startIdleMonitor();
  }

  stopIdleMonitor() {
    return this.lifecycleService.stopIdleMonitor();
  }
}
