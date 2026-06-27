import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { generateRuntimeArtifact } from '../config/generators/runtime-artifact-generator.js';

export class EnvironmentManager {
  constructor({ runner, scriptPath, namespace, statePath, runtimeConfigPath }) {
    this.runner = runner;
    this.scriptPath = scriptPath;
    this.namespace = namespace;
    this.statePath = statePath;
    this.runtimeConfigPath = runtimeConfigPath;
  }

  ensureHostDirectories(env, mineopsConfig = null) {
    const paths = [env.MINEOPS_STORAGE_PATH, env.MINEOPS_BACKUP_HOST_PATH];
    for (const instance of mineopsConfig?.instances ?? []) {
      if (instance.name !== 'default') {
        paths.push(path.join(env.MINEOPS_BACKUP_HOST_PATH, instance.name));
      }
    }
    const existed = paths.every((item) => fs.existsSync(item));
    for (const item of paths) fs.mkdirSync(item, { recursive: true });
    return { changed: !existed, message: 'Host storage directories are ready' };
  }

  artifactPath(instance) {
    if (instance.name === 'default') return this.runtimeConfigPath;
    return path.join(path.dirname(this.runtimeConfigPath), instance.name, 'runtime-config.json');
  }

  runtimeArtifactJson(mineopsConfig, instance) {
    return `${JSON.stringify(generateRuntimeArtifact(mineopsConfig, instance), null, 2)}\n`;
  }

  runtimeFingerprint(artifacts) {
    const hash = crypto.createHash('sha256');
    for (const artifact of artifacts) {
      hash.update(artifact.instance.name);
      hash.update('\0');
      hash.update(artifact.json);
      hash.update('\0');
    }
    return hash.digest('hex');
  }

  storedRuntimeFingerprint() {
    if (!fs.existsSync(this.statePath)) return null;
    return fs.readFileSync(this.statePath, 'utf8').trim() || null;
  }

  writeRuntimeArtifact(runtimeArtifactJson, artifactPath) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    const previous = fs.existsSync(artifactPath) ? fs.readFileSync(artifactPath, 'utf8') : null;
    if (previous === runtimeArtifactJson) return false;
    fs.writeFileSync(artifactPath, runtimeArtifactJson, 'utf8');
    return true;
  }

  injectRuntimeConfig(mineopsConfig) {
    const artifacts = mineopsConfig.instances.map((instance) => ({
      instance,
      path: this.artifactPath(instance),
      json: this.runtimeArtifactJson(mineopsConfig, instance),
    }));
    const fingerprint = this.runtimeFingerprint(artifacts);
    const previous = this.storedRuntimeFingerprint();

    for (const artifact of artifacts) {
      this.writeRuntimeArtifact(artifact.json, artifact.path);
      this.runner.run('powershell', [
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        this.scriptPath,
        '-RuntimeConfigPath',
        artifact.path,
        '-Namespace',
        artifact.instance.namespace,
      ], { quiet: true });
    }

    fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    fs.writeFileSync(this.statePath, `${fingerprint}\n`, 'utf8');
    return {
      changed: previous !== fingerprint,
      message: previous === fingerprint ? 'Runtime secrets and config already current' : 'Runtime secrets and config applied',
    };
  }
}