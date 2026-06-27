import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export class EnvironmentManager {
  constructor({ runner, scriptPath, namespace, statePath, envPath = null }) {
    this.runner = runner;
    this.scriptPath = scriptPath;
    this.namespace = namespace;
    this.statePath = statePath;
    this.envPath = envPath;
  }

  ensureHostDirectories(env) {
    const existed = fs.existsSync(env.MINEOPS_STORAGE_PATH) && fs.existsSync(env.MINEOPS_BACKUP_HOST_PATH);
    fs.mkdirSync(env.MINEOPS_STORAGE_PATH, { recursive: true });
    fs.mkdirSync(env.MINEOPS_BACKUP_HOST_PATH, { recursive: true });
    return { changed: !existed, message: 'Host storage directories are ready' };
  }

  runtimeFingerprint(mineopsConfig) {
    const hash = crypto.createHash('sha256');
    hash.update('.env');
    hash.update('\0');
    hash.update(mineopsConfig.globals.raw.env ?? '');
    hash.update('\0');
    hash.update('mineops-admins.json');
    hash.update('\0');
    hash.update(mineopsConfig.globals.raw.admins ?? '');
    hash.update('\0');
    hash.update('derived-time-zone');
    hash.update('\0');
    hash.update(mineopsConfig.globals.env.MINEOPS_TIME_ZONE || 'UTC');
    hash.update('\0');
    hash.update('derived-time-offset');
    hash.update('\0');
    hash.update(String(mineopsConfig.globals.env.MINEOPS_TIME_OFFSET_SECONDS || '0'));
    hash.update('\0');
    return hash.digest('hex');
  }

  storedRuntimeFingerprint() {
    if (!fs.existsSync(this.statePath)) return null;
    return fs.readFileSync(this.statePath, 'utf8').trim() || null;
  }

  injectRuntimeConfig(mineopsConfig) {
    const fingerprint = this.runtimeFingerprint(mineopsConfig);
    const previous = this.storedRuntimeFingerprint();
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath, '-Namespace', this.namespace];
    if (this.envPath) args.push('-EnvPath', this.envPath);
    this.runner.run('powershell', args, { quiet: true });
    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, `${fingerprint}\n`, 'utf8');
    return {
      changed: previous !== fingerprint,
      message: previous === fingerprint ? 'Runtime secrets and config already current' : 'Runtime secrets and config applied',
    };
  }
}
