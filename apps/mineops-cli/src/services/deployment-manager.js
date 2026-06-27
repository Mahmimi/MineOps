import fs from 'node:fs';
import path from 'node:path';
import { PlatformError } from '../domain/errors.js';
import { generateTerraformVars } from '../config/generators/terraform-vars-generator.js';
import { generateDiscordManifest } from '../config/generators/discord-manifest-generator.js';

export class DeploymentManager {
  constructor({ runner, terraformPath, manifestsPath, namespace, generatedRoot, botImage }) {
    this.runner = runner;
    this.terraformPath = terraformPath;
    this.manifestsPath = manifestsPath;
    this.namespace = namespace;
    this.generatedRoot = generatedRoot;
    this.botImage = botImage;
  }

  legacySingleInstance(mineopsConfig, instance) {
    return mineopsConfig.source === 'legacy' && mineopsConfig.instances.length === 1 && instance.name === 'default';
  }

  terraformWorkdir(mineopsConfig, instance) {
    if (this.legacySingleInstance(mineopsConfig, instance)) return this.terraformPath;
    const workdir = path.join(this.generatedRoot, 'terraform', instance.name);
    fs.mkdirSync(workdir, { recursive: true });
    for (const entry of fs.readdirSync(this.terraformPath, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.tf')) continue;
      fs.copyFileSync(path.join(this.terraformPath, entry.name), path.join(workdir, entry.name));
    }
    const lockPath = path.join(this.terraformPath, '.terraform.lock.hcl');
    if (fs.existsSync(lockPath)) fs.copyFileSync(lockPath, path.join(workdir, '.terraform.lock.hcl'));
    return workdir;
  }

  writeTerraformVars(mineopsConfig, instance, workdir) {
    const varsPath = path.join(workdir, 'terraform.tfvars.json');
    const vars = generateTerraformVars(mineopsConfig, instance);
    const next = `${JSON.stringify(vars, null, 2)}\n`;
    const previous = fs.existsSync(varsPath) ? fs.readFileSync(varsPath, 'utf8') : null;
    if (previous === next) return { changed: false, message: 'Terraform variables already generated' };
    fs.writeFileSync(varsPath, next, 'utf8');
    return { changed: true, message: 'Terraform variables generated' };
  }

  terraformPlanClean(workdir = this.terraformPath) {
    const result = this.runner.run('terraform', ['plan', '-detailed-exitcode', '-no-color'], {
      cwd: workdir,
      capture: true,
      allowFailure: true,
      env: { TF_IN_AUTOMATION: '1' },
    });
    if (result.status === 1) {
      throw new PlatformError('terraform plan failed', { cause: result.stderr || result.stdout });
    }
    return result.status === 0;
  }

  terraformTargetPlanClean(targets) {
    const args = ['plan', '-detailed-exitcode', '-no-color'];
    for (const target of targets) args.push(`-target=${target}`);
    const result = this.runner.run('terraform', args, {
      cwd: this.terraformPath,
      capture: true,
      allowFailure: true,
      env: { TF_IN_AUTOMATION: '1' },
    });
    if (result.status === 1) {
      throw new PlatformError('terraform plan failed', { cause: result.stderr || result.stdout });
    }
    return result.status === 0;
  }

  applyInfrastructure(mineopsConfig) {
    let changed = false;
    for (const instance of mineopsConfig.instances) {
      const workdir = this.terraformWorkdir(mineopsConfig, instance);
      this.writeTerraformVars(mineopsConfig, instance, workdir);
      this.runner.run('terraform', ['init', '-input=false', '-no-color'], {
        cwd: workdir,
        quiet: true,
        env: { TF_IN_AUTOMATION: '1' },
      });

      if (this.terraformPlanClean(workdir)) continue;

      this.runner.run('terraform', ['apply', '-auto-approve', '-input=false', '-no-color'], {
        cwd: workdir,
        quiet: true,
        env: { TF_IN_AUTOMATION: '1' },
      });
      changed = true;
    }
    return { changed, message: changed ? 'Terraform infrastructure reconciled' : 'Terraform infrastructure already matches configuration' };
  }

  reconcileBackupRuntime() {
    const targets = [
      'kubernetes_config_map_v1.minecraft_backup',
      'kubernetes_cron_job_v1.minecraft_backup',
    ];

    this.runner.run('terraform', ['init', '-input=false', '-no-color'], {
      cwd: this.terraformPath,
      quiet: true,
      env: { TF_IN_AUTOMATION: '1' },
    });

    if (this.terraformTargetPlanClean(targets)) {
      return { changed: false, message: 'Backup runtime already matches configuration' };
    }

    const args = ['apply', '-auto-approve', '-input=false', '-no-color'];
    for (const target of targets) args.push(`-target=${target}`);
    this.runner.run('terraform', args, {
      cwd: this.terraformPath,
      quiet: true,
      env: { TF_IN_AUTOMATION: '1' },
    });
    return { changed: true, message: 'Backup runtime reconciled' };
  }

  manifestPath(mineopsConfig, instance) {
    if (this.legacySingleInstance(mineopsConfig, instance)) return this.manifestsPath;
    const dir = path.join(this.generatedRoot, 'manifests', instance.name);
    fs.mkdirSync(dir, { recursive: true });
    const manifestPath = path.join(dir, 'discord-bot.yaml');
    fs.writeFileSync(manifestPath, generateDiscordManifest(instance, { image: this.botImage }), 'utf8');
    return manifestPath;
  }

  applyManifests(mineopsConfig) {
    let changed = false;
    for (const instance of mineopsConfig.instances) {
      const manifestPath = this.manifestPath(mineopsConfig, instance);
      const args = this.legacySingleInstance(mineopsConfig, instance)
        ? ['apply', '-f', manifestPath, '--recursive']
        : ['apply', '-f', manifestPath];
      const result = this.runner.run('kubectl', args, { capture: true });
      const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
      changed = changed || lines.length === 0 || lines.some((line) => !line.endsWith(' unchanged'));
    }
    return {
      changed,
      message: changed ? 'Platform manifests reconciled' : 'Platform manifests already match configuration',
    };
  }

  ensureRuntimeTimeZone(timeZone, mineopsConfig = null) {
    let changed = false;
    const namespaces = mineopsConfig?.instances?.map((instance) => instance.namespace) ?? [this.namespace];
    for (const namespace of namespaces) {
      for (const deployment of ['minecraft', 'playit']) {
        const current = this.runner.run('kubectl', [
          'get',
          `deployment/${deployment}`,
          '-n',
          namespace,
          '-o',
          'jsonpath={.spec.template.spec.containers[*].env[?(@.name=="TZ")].value}',
        ], { capture: true, allowFailure: true });
        const values = current.stdout.trim().split(/\s+/).filter(Boolean);
        if (current.status === 0 && values.length > 0 && values.every((value) => value === timeZone)) continue;

        this.runner.run('kubectl', ['set', 'env', `deployment/${deployment}`, '-n', namespace, `TZ=${timeZone}`], { quiet: true, allowFailure: true });
        changed = true;
      }
    }
    return {
      changed,
      message: changed ? `Runtime timezone set to ${timeZone}` : `Runtime timezone already ${timeZone}`,
    };
  }

  deploymentOnline(name, namespace = this.namespace) {
    const result = this.runner.run('kubectl', ['get', `deployment/${name}`, '-n', namespace, '-o', 'json'], {
      capture: true,
      allowFailure: true,
    });
    if (result.status !== 0) return false;
    try {
      const deployment = JSON.parse(result.stdout);
      const desired = deployment.spec?.replicas ?? 0;
      const ready = deployment.status?.readyReplicas ?? 0;
      const available = deployment.status?.availableReplicas ?? 0;
      return desired === 0 || (ready >= desired && available >= desired);
    } catch {
      return false;
    }
  }

  waitForRollout(name, timeout, namespace = this.namespace) {
    const result = this.runner.run('kubectl', ['rollout', 'status', `deployment/${name}`, '-n', namespace, `--timeout=${timeout}`], {
      capture: true,
      allowFailure: true,
    });
    if (result.status === 0) return null;
    if (this.deploymentOnline(name, namespace)) {
      return `${namespace}/${name} rollout status did not complete cleanly, but deployment is online`;
    }
    return `${namespace}/${name} rollout status did not complete`;
  }

  waitForWorkloads({ enabled = true, restartDiscordBot = false, restartPlayit = false, mineopsConfig = null } = {}) {
    if (!enabled) {
      return { changed: false, message: 'No workload changes detected' };
    }

    const namespaces = mineopsConfig?.instances?.map((instance) => instance.namespace) ?? [this.namespace];
    for (const namespace of namespaces) {
      if (restartPlayit) {
        this.runner.run('kubectl', ['rollout', 'restart', 'deployment/playit', '-n', namespace], { quiet: true, allowFailure: true });
      }
      if (restartDiscordBot) {
        this.runner.run('kubectl', ['rollout', 'restart', 'deployment/discord-bot', '-n', namespace], { quiet: true, allowFailure: true });
      }
    }

    const warnings = namespaces.flatMap((namespace) => [
      this.waitForRollout('minecraft', '300s', namespace),
      this.waitForRollout('playit', '180s', namespace),
      this.waitForRollout('discord-bot', '180s', namespace),
    ]).filter(Boolean);

    return {
      changed: restartDiscordBot || restartPlayit,
      warning: warnings.length > 0,
      message: warnings.length > 0 ? `${warnings.join('; ')}; health verification follows` : 'Workload rollouts checked',
    };
  }
}