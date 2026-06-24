import fs from 'node:fs';
import path from 'node:path';

export class AlertHistoryStore {
  constructor({ directory = '/app/data/alerts', logger }) {
    this.directory = directory;
    this.logger = logger;
    this.filePath = path.join(directory, 'alerts.jsonl');
  }

  ensureDirectory() {
    fs.mkdirSync(this.directory, { recursive: true });
  }

  append(record) {
    try {
      this.ensureDirectory();
      const payload = {
        timestamp: new Date().toISOString(),
        type: record.type,
        severity: record.severity ?? 'INFO',
        message: record.message,
        resolved: record.resolved ?? false,
      };
      fs.appendFileSync(this.filePath, `${JSON.stringify(payload)}\n`, 'utf8');
    } catch (error) {
      this.logger?.error('failed to persist alert history', { error: error.message });
    }
  }
}
