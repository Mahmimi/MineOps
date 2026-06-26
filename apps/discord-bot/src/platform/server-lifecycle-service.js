import { localTimestamp, parseTimestamp } from '../../../utils/time.js';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function operationBlocked(message, lock) {
  const error = new Error(message);
  error.code = 'MINEOPS_OPERATION_BLOCKED';
  error.lock = lock;
  return error;
}

export class ServerLifecycleService {
  constructor({ config, statusProvider, playerProvider, stateStore, lockService, logger }) {
    this.config = config;
    this.statusProvider = statusProvider;
    this.playerProvider = playerProvider;
    this.stateStore = stateStore;
    this.lockService = lockService;
    this.logger = logger;
    this.timer = null;
    this.idleEvaluationInProgress = false;
  }

  async operationBlockedBySafety() {
    const backup = await this.statusProvider.getBackupInfo();
    if (backup.backupRunning) return operationBlocked('Backup currently in progress.', { type: 'backup' });
    const activeLock = this.lockService.current();
    if (activeLock) return operationBlocked(`${activeLock.type} currently in progress.`, activeLock);
    return null;
  }

  async ensureNoSafetyBlock() {
    const blocked = await this.operationBlockedBySafety();
    if (blocked) throw blocked;
  }

  async runLocked(type, owner, callback) {
    this.lockService.acquire({ type, owner });
    this.stateStore.setLifecycleState({ state: type.toUpperCase(), activeOperation: type });
    try {
      return await callback();
    } finally {
      this.lockService.release(type);
    }
  }

  async broadcast(message) {
    await this.statusProvider.execMinecraftConsole(`say ${message}`);
  }

  async saveWorld() {
    await this.statusProvider.execMinecraftConsole('save-all');
    await delay(2000);
  }

  async waitForQueryReady(timeoutMs = 60000) {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      last = await this.playerProvider.getPlayers();
      if (last.available) return last;
      await delay(3000);
    }
    throw new Error('Minecraft query service did not respond before timeout');
  }

  async checkQueryReady({ timeoutMs = 60000, operation = 'lifecycle operation' } = {}) {
    try {
      return await this.waitForQueryReady(timeoutMs);
    } catch (error) {
      this.logger?.warn('minecraft query unavailable after lifecycle readiness', {
        operation,
        error: error.message,
      });
      return {
        available: false,
        reason: error.message,
      };
    }
  }

  async startServer({ actor = 'MineOps' } = {}) {
    const status = await this.statusProvider.getStatus();
    if (status.running) {
      return { changed: false, state: 'RUNNING', title: 'Minecraft Already Running', message: 'No action was required.' };
    }

    await this.ensureNoSafetyBlock();
    return this.runLocked('starting', actor, async () => {
      await this.statusProvider.scaleMinecraft(1);
      const ready = await this.statusProvider.waitForMinecraftReady({ timeoutMs: this.config.lifecycle.readinessTimeoutMs });
      const query = await this.checkQueryReady({ operation: 'start' });
      await this.statusProvider.setBackupCronJobSuspended(false);
      this.stateStore.setLifecycleState({ state: 'RUNNING', idleStartedAt: null });
      this.stateStore.appendEvent({ type: 'minecraft', severity: 'INFO', message: 'Server Started' });
      if (!query.available) {
        return {
          changed: true,
          state: 'RUNNING',
          warning: true,
          title: 'Minecraft Started',
          message: 'Server pod is ready, but player query did not respond yet. Status may catch up shortly.',
          status: ready,
        };
      }
      return { changed: true, state: 'RUNNING', title: 'Minecraft Online', message: 'Server is ready for players.', status: ready };
    });
  }

  async stopServer({ actor = 'MineOps', warn = true } = {}) {
    const status = await this.statusProvider.getStatus();
    if (!status.running && (status.desiredReplicas ?? 0) === 0) {
      return { changed: false, state: 'STOPPED', title: 'Minecraft Already Offline', message: 'No action was required.' };
    }

    await this.ensureNoSafetyBlock();
    return this.runLocked('stopping', actor, async () => {
      await this.statusProvider.setBackupCronJobSuspended(true);
      if (warn && status.running) {
        await this.broadcast(`[MineOps] Server shutdown initiated by ${actor}. Server will stop in 30 seconds.`);
        await delay(30000);
      }
      const current = await this.statusProvider.getStatus();
      if (current.running) await this.saveWorld();
      await this.statusProvider.scaleMinecraft(0);
      await this.statusProvider.waitForMinecraftStopped({ timeoutMs: this.config.lifecycle.readinessTimeoutMs });
      this.stateStore.setLifecycleState({ state: 'STOPPED', idleStartedAt: null });
      this.stateStore.appendEvent({ type: 'minecraft', severity: 'INFO', message: actor === 'Idle shutdown' ? 'Auto Shutdown Triggered' : 'Server Stopped' });
      return { changed: true, state: 'STOPPED', title: 'Minecraft Offline', message: 'Server successfully stopped.' };
    });
  }

  async restartServer({ actor = 'MineOps' } = {}) {
    const status = await this.statusProvider.getStatus();
    if (!status.running) {
      return this.startServer({ actor });
    }

    await this.ensureNoSafetyBlock();
    return this.runLocked('restarting', actor, async () => {
      await this.broadcast(`[MineOps] Server restart initiated by ${actor}. Temporary lag may occur.`);
      await this.saveWorld();
      await this.statusProvider.execMinecraftConsole('save-off');
      let query = { available: false };
      try {
        await this.statusProvider.restartMinecraft();
        await this.statusProvider.waitForMinecraftReady({ timeoutMs: this.config.lifecycle.readinessTimeoutMs });
        query = await this.checkQueryReady({ operation: 'restart' });
      } finally {
        try { await this.statusProvider.execMinecraftConsole('save-on'); } catch (error) { this.logger?.warn('save-on after restart failed', { error: error.message }); }
      }
      this.stateStore.setLifecycleState({ state: 'RUNNING', idleStartedAt: null });
      this.stateStore.appendEvent({ type: 'minecraft', severity: 'INFO', message: 'Server Restarted' });
      if (!query.available) {
        return {
          changed: true,
          state: 'RUNNING',
          warning: true,
          title: 'Minecraft Restarted',
          message: 'Server pod is ready, but player query did not respond yet. Status may catch up shortly.',
        };
      }
      return { changed: true, state: 'RUNNING', title: 'Minecraft Restarted', message: 'Server is ready for players.' };
    });
  }

  async evaluateIdleShutdown() {
    if (this.idleEvaluationInProgress) return;
    this.idleEvaluationInProgress = true;
    try {
      if (!this.config.lifecycle.idleShutdownEnabled) return;
      const maintenance = this.stateStore.getMaintenance();
      if (maintenance.enabled) return;
      if (this.lockService.current()) return;

      const backup = await this.statusProvider.getBackupInfo();
      if (backup.backupRunning) return;

      const status = await this.statusProvider.getStatus();
      if (!status.running) {
        this.stateStore.setLifecycleState({ state: 'STOPPED', idleStartedAt: null });
        return;
      }

      const players = await this.playerProvider.getPlayers();
      const online = players.available ? players.onlineCount ?? 0 : 1;
      const lifecycle = this.stateStore.getLifecycleState();
      if (online > 0) {
        if (lifecycle.idleStartedAt) this.stateStore.appendEvent({ type: 'minecraft', severity: 'INFO', message: 'Idle Timeout Cancelled' });
        this.stateStore.setLifecycleState({ state: 'RUNNING', idleStartedAt: null });
        return;
      }

      if (!lifecycle.idleStartedAt) {
        this.stateStore.setLifecycleState({ state: 'RUNNING', idleStartedAt: localTimestamp() });
        this.stateStore.appendEvent({ type: 'minecraft', severity: 'INFO', message: 'Idle Timeout Started' });
        return;
      }

      const idleMs = Date.now() - parseTimestamp(lifecycle.idleStartedAt).getTime();
      if (idleMs >= this.config.lifecycle.idleShutdownMinutes * 60000) {
        await this.stopServer({ actor: 'Idle shutdown', warn: false });
      }
    } finally {
      this.idleEvaluationInProgress = false;
    }
  }

  startIdleMonitor() {
    if (this.timer || !this.config.lifecycle.idleShutdownEnabled) return null;
    this.timer = setInterval(() => {
      this.evaluateIdleShutdown().catch((error) => this.logger?.error('idle shutdown evaluation failed', { error: error.message }));
    }, this.config.lifecycle.intervalMs);
    this.timer.unref();
    this.evaluateIdleShutdown().catch((error) => this.logger?.error('initial idle shutdown evaluation failed', { error: error.message }));
    return this.timer;
  }

  stopIdleMonitor() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
