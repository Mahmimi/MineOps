import { localTimestamp, parseTimestamp } from '../../../utils/time.js';

export class DataService {
  constructor({ runner, namespace }) {
    this.runner = runner;
    this.namespace = namespace;
    this.base = '/app/data';
  }

  botExec(script, { allowFailure = true } = {}) {
    return this.runner.run('kubectl', ['exec', '-n', this.namespace, 'deployment/discord-bot', '--', 'sh', '-lc', script], { capture: true, allowFailure });
  }

  readJsonl(remotePath) {
    const result = this.botExec(`test -f ${remotePath} && tail -n 100 ${remotePath} || true`);
    if (result.status !== 0 || !result.stdout.trim()) return [];
    return result.stdout.trim().split(/\r?\n/).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  }

  appendJsonl(relativePath, record) {
    const remotePath = `${this.base}/${relativePath}`;
    const payload = JSON.stringify({ timestamp: localTimestamp(), ...record }).replace(/'/g, "'\\''");
    this.botExec(`mkdir -p $(dirname ${remotePath}) && printf '%s\\n' '${payload}' >> ${remotePath}`);
  }

  events() {
    return this.readJsonl(`${this.base}/events/events.jsonl`);
  }

  alerts() {
    return this.readJsonl(`${this.base}/alerts/alerts.jsonl`);
  }

  activeAlerts() {
    const latestByType = new Map();
    for (const alert of [...this.alerts()].sort((a, b) => parseTimestamp(b.timestamp ?? 0).getTime() - parseTimestamp(a.timestamp ?? 0).getTime())) {
      const key = alert.type ?? alert.message ?? 'unknown';
      if (!latestByType.has(key)) latestByType.set(key, alert);
    }
    return [...latestByType.values()].filter((alert) => !alert.resolved);
  }

  appendEvent(event) {
    this.appendJsonl('events/events.jsonl', event);
  }

  appendAlert(alert) {
    this.appendJsonl('alerts/alerts.jsonl', alert);
  }

  maintenance() {
    const result = this.botExec(`test -f ${this.base}/maintenance/state.json && cat ${this.base}/maintenance/state.json || true`);
    if (result.status !== 0 || !result.stdout.trim()) return { enabled: false };
    try { return JSON.parse(result.stdout); } catch { return { enabled: false }; }
  }

  setMaintenance(enabled, reason = 'Scheduled maintenance') {
    const payload = JSON.stringify({ enabled, reason, timestamp: localTimestamp() }).replace(/'/g, "'\\''");
    this.botExec(`mkdir -p ${this.base}/maintenance && printf '%s' '${payload}' > ${this.base}/maintenance/state.json`, { allowFailure: false });
    this.appendEvent({ type: 'maintenance', severity: 'INFO', message: enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled' });
  }
}
