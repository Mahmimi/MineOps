import fs from 'node:fs';
import path from 'node:path';

export class PlatformStateStore {
  constructor({ directory = '/app/data', logger }) {
    this.directory = directory;
    this.logger = logger;
    this.alertsPath = path.join(directory, 'alerts', 'alerts.jsonl');
    this.eventsPath = path.join(directory, 'events', 'events.jsonl');
    this.maintenancePath = path.join(directory, 'maintenance', 'state.json');
    this.lifecyclePath = path.join(directory, 'lifecycle', 'state.json');
    this.lockPath = path.join(directory, 'lifecycle', 'lock.json');
  }

  ensure(filePath) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  appendJsonl(filePath, record) {
    try {
      this.ensure(filePath);
      fs.appendFileSync(filePath, `${JSON.stringify({ timestamp: new Date().toISOString(), ...record })}\n`, 'utf8');
    } catch (error) {
      this.logger?.error('failed to persist platform state record', { error: error.message });
    }
  }

  readJsonl(filePath, limit = 20) {
    try {
      if (!fs.existsSync(filePath)) return [];
      return fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
        .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
        .slice(0, limit);
    } catch (error) {
      this.logger?.warn('failed to read platform state records', { error: error.message });
      return [];
    }
  }

  readJson(filePath, fallback) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      this.logger?.warn('failed to read platform state json', { error: error.message, filePath });
      return fallback;
    }
  }

  writeJson(filePath, value) {
    try {
      this.ensure(filePath);
      fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
    } catch (error) {
      this.logger?.error('failed to write platform state json', { error: error.message, filePath });
    }
  }

  appendAlert(record) {
    this.appendJsonl(this.alertsPath, {
      type: record.type,
      severity: record.severity ?? 'INFO',
      message: record.message,
      resolved: record.resolved ?? false,
    });
  }

  appendEvent(record) {
    this.appendJsonl(this.eventsPath, {
      type: record.type ?? 'system',
      severity: record.severity ?? 'INFO',
      message: record.message,
    });
  }

  queryEvents({ type, limit = 20 } = {}) {
    return this.readJsonl(this.eventsPath, 200)
      .filter((event) => !type || event.type === type)
      .slice(0, limit);
  }

  queryAlerts({ activeOnly = false, limit = 20 } = {}) {
    const alerts = this.readJsonl(this.alertsPath, 200);
    if (!activeOnly) return alerts.slice(0, limit);

    const latestByType = new Map();
    for (const alert of alerts) {
      const key = alert.type ?? alert.message ?? 'unknown';
      if (!latestByType.has(key)) latestByType.set(key, alert);
    }
    return [...latestByType.values()].filter((alert) => !alert.resolved).slice(0, limit);
  }

  getMaintenance() {
    try {
      if (!fs.existsSync(this.maintenancePath)) return { enabled: false };
      return JSON.parse(fs.readFileSync(this.maintenancePath, 'utf8'));
    } catch (error) {
      this.logger?.warn('failed to read maintenance state', { error: error.message });
      return { enabled: false };
    }
  }

  getLifecycleState() {
    return this.readJson(this.lifecyclePath, { state: 'UNKNOWN', idleStartedAt: null });
  }

  setLifecycleState(state) {
    this.writeJson(this.lifecyclePath, { updatedAt: new Date().toISOString(), ...state });
  }

  getOperationLock() {
    return this.readJson(this.lockPath, null);
  }

  setOperationLock(lock) {
    this.writeJson(this.lockPath, lock);
  }

  clearOperationLock() {
    try {
      if (fs.existsSync(this.lockPath)) fs.unlinkSync(this.lockPath);
    } catch (error) {
      this.logger?.warn('failed to clear operation lock', { error: error.message });
    }
  }
}
