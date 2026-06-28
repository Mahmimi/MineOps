import { localTimestamp, parseTimestamp } from '../../../utils/time.js';
import { resourceNamesFor } from '../domain/resource-names.js';

export class DataService {
  constructor({ runner }) {
    this.runner = runner;
    this.base = '/app/data';
  }

  botExec(instance, script, { allowFailure = true } = {}) {
    const names = resourceNamesFor(instance);
    return this.runner.run('kubectl', ['exec', '-n', instance.namespace, `deployment/${names.discordDeployment}`, '--', 'sh', '-lc', script], { capture: true, allowFailure });
  }

  readJsonl(instance, remotePath) {
    const result = this.botExec(instance, `test -f ${remotePath} && tail -n 100 ${remotePath} || true`);
    if (result.status !== 0 || !result.stdout.trim()) return [];
    return result.stdout.trim().split(/\r?\n/).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }

  appendJsonl(instance, relativePath, record) {
    const remotePath = `${this.base}/${relativePath}`;
    const payload = JSON.stringify({ timestamp: localTimestamp(), ...record }).replace(/'/g, "'\\''");
    this.botExec(instance, `mkdir -p $(dirname ${remotePath}) && printf '%s\\n' '${payload}' >> ${remotePath}`);
  }

  events(instance) {
    return this.readJsonl(instance, `${this.base}/events/events.jsonl`);
  }

  alerts(instance) {
    return this.readJsonl(instance, `${this.base}/alerts/alerts.jsonl`);
  }

  activeAlerts(instance) {
    const latestByType = new Map();
    for (const alert of [...this.alerts(instance)].sort((a, b) => parseTimestamp(b.timestamp ?? 0).getTime() - parseTimestamp(a.timestamp ?? 0).getTime())) {
      const key = alert.type ?? alert.message ?? 'unknown';
      if (!latestByType.has(key)) latestByType.set(key, alert);
    }
    return [...latestByType.values()].filter((alert) => !alert.resolved);
  }

  appendEvent(instance, event) {
    this.appendJsonl(instance, 'events/events.jsonl', event);
  }

  appendAlert(instance, alert) {
    this.appendJsonl(instance, 'alerts/alerts.jsonl', alert);
  }

  maintenance(instance) {
    const result = this.botExec(instance, `test -f ${this.base}/maintenance/state.json && cat ${this.base}/maintenance/state.json || true`);
    if (result.status !== 0 || !result.stdout.trim()) return { enabled: false };
    try { return JSON.parse(result.stdout); } catch { return { enabled: false }; }
  }

  setMaintenance(instance, enabled, reason = 'Scheduled maintenance') {
    const payload = JSON.stringify({ enabled, reason, timestamp: localTimestamp() }).replace(/'/g, "'\\''");
    this.botExec(instance, `mkdir -p ${this.base}/maintenance && printf '%s' '${payload}' > ${this.base}/maintenance/state.json`, { allowFailure: false });
    this.appendEvent(instance, { type: 'maintenance', severity: 'INFO', message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled' });
  }
}
