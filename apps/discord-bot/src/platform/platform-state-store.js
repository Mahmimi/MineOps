import fs from 'node:fs';
import path from 'node:path';

export class PlatformStateStore {
  constructor({ directory = '/app/data', logger }) {
    this.directory = directory;
    this.logger = logger;
    this.alertsPath = path.join(directory, 'alerts', 'alerts.jsonl');
    this.eventsPath = path.join(directory, 'events', 'events.jsonl');
    this.maintenancePath = path.join(directory, 'maintenance', 'state.json');
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

  getMaintenance() {
    try {
      if (!fs.existsSync(this.maintenancePath)) return { enabled: false };
      return JSON.parse(fs.readFileSync(this.maintenancePath, 'utf8'));
    } catch (error) {
      this.logger?.warn('failed to read maintenance state', { error: error.message });
      return { enabled: false };
    }
  }
}
