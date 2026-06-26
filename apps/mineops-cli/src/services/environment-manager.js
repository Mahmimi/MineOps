import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class EnvironmentManager {
  constructor({ runner, scriptPath, namespace, statePath }) {
    this.runner = runner;
    this.scriptPath = scriptPath;
    this.namespace = namespace;
    this.statePath = statePath;
  }

  ensureHostDirectories(env) {
    const existed = fs.existsSync(env.MINEOPS_STORAGE_PATH) && fs.existsSync(env.MINEOPS_BACKUP_HOST_PATH);
    fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true });
    fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true });
    return { changed: !existed, message: 'Host storage directories are ready' };
  }

  runtimeFingerprint() {
    const root = path.dirname(path.dirname(this.scriptPath));
    const hash = crypto.createHash('sha256');
    for (const file of ['.env', 'mineops-admins.json']) {
      const filePath = path.join(root, file);
      hash.update(file);
      hash.update('\0');
      if (fs.existsSync(filePath)) hash.update(fs.readFileSync(filePath));
      hash.update('\0');
    }
    hash.update('derived-time-zone');
    hash.update('\0');
    hash.update(process.env.MINEOPS_TIME_ZONE || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    hash.update('\0');
    hash.update('derived-time-offset');
    hash.update('\0');
    hash.update(String(new Date().getTimezoneOffset()));
    hash.update('\0');
    return hash.digest('hex');
  }

  storedRuntimeFingerprint() {
    if (!fs.existsSync(this.statePath)) return null;
    return fs.readFileSync(this.statePath, 'utf8').trim() || null;
  }

  injectRuntimeConfig() {
    const fingerprint = this.runtimeFingerprint();
    const previous = this.storedRuntimeFingerprint();
    this.runner.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath, '-Namespace', this.namespace], { quiet: true });
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, `${fingerprint}\n`, 'utf8');
    return {
      changed: previous !== fingerprint,
      message: previous === fingerprint ? 'Runtime secrets and config already current' : 'Runtime secrets and config applied',
    };
  }
}
