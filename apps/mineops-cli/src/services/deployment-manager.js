import fs from 'node:fs';
import path from 'node:path';
import { PlatformError } from '../domain/errors.js';
import { generateTerraformVars } from '../config/generators/terraform-vars-generator.js';

export class DeploymentManager {
  constructor({ runner, terraformPath, manifestsPath, namespace }) {
    this.runner = runner;
    this.terraformPath = terraformPath;
    this.manifestsPath = manifestsPath;
    this.namespace = namespace;
  }

  writeTerraformVars(mineopsConfig) {
    const varsPath = path.join(this.terraformPath, 'terraform.tfvars.json');
    const vars = generateTerraformVars(mineopsConfig);
    const next = ${JSON.stringify(vars, null, 2)}\\n;
    const previous = fs.existsSync(varsPath) ? fs.readFileSync(varsPath, 'utf8') : null;
    if (previous === next) return { changed: false, message: 'Terraform variables already generated' };
    fs.writeFileSync(varsPath, next, 'utf8');
    return { changed: true, message: 'Terraform variables generated' };
  }

  terraformPlanClean() {
    const result = this.runner.run('terraform', ['plan', '-detailed-exitcode', '-no-color'], {
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
    this.writeTerraformVars(mineopsConfig);
    this.runner.run('terraform', ['init', '-input=false', '-no-color'], {
      cwd: this.terraformPath,
      quiet: true,
      env: { TF_IN_AUTOMATION: '1' },
    });

    if (this.terraformPlanClean()) {
      return { changed: false, message: 'Terraform infrastructure already matches configuration' };
    }

    this.runner.run('terraform', ['apply', '-auto-approve', '-input=false', '-no-color'], {
      cwd: this.terraformPath,
      quiet: true,
      env: { TF_IN_AUTOMATION: '1' },
    });
    return { changed: true, message: 'Terraform infrastructure reconciled' };
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

  applyManifests() {
    const result = this.runner.run('kubectl', ['apply', '-f', this.manifestsPath, '--recursive'], { capture: true });
    const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
    const changed = lines.length === 0 || lines.some((line) => !line.endsWith(' unchanged'));
    return {
      changed,
      message: changed ? 'Platform manifests reconciled' : 'Platform manifests already match configuration',
    };
  }

  ensureRuntimeTimeZone(timeZone) {
    let changed = false;
    for (const deployment of ['minecraft', 'playit']) {
      const current = this.runner.run('kubectl', [
        'get',
        `deployment/${deployment}`,
        '-n',
        this.namespace,
        '-o',
        'jsonpath={.spec.template.spec.containers[*].env[?(@.name=="TZ")].value}',
      ], { capture: true, allowFailure: true });
      const values = current.stdout.trim().split(/\s+/).filter(Boolean);
      if (current.status === 0 && values.length > 0 && values.every((value) => value === timeZone)) continue;

      this.runner.run('kubectl', ['set', 'env', `deployment/${deployment}`, '-n', this.namespace, `TZ=${timeZone}`], { quiet: true });
      changed = true;
    }
    return {
      changed,
      message: changed ? `Runtime timezone set to ${timeZone}` : `Runtime timezone already ${timeZone}`,
    };
  }

  deploymentOnline(name) {
    const result = this.runner.run('kubectl', ['get', `deployment/${name}`, '-n', this.namespace, '-o', 'json'], {
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

  waitForRollout(name, timeout) {
    const result = this.runner.run('kubectl', ['rollout', 'status', `deployment/${name}`, '-n', this.namespace, `--timeout=${timeout}`], {
      capture: true,
      allowFailure: true,
    });
    if (result.status === 0) return null;
    if (this.deploymentOnline(name)) {
      return `${name} rollout status did not complete cleanly, but deployment is online`;
    }
    return `${name} rollout status did not complete`;
  }

  waitForWorkloads({ enabled = true, restartDiscordBot = false, restartPlayit = false } = {}) {
    if (!enabled) {
      return { changed: false, message: 'No workload changes detected' };
    }

    if (restartPlayit) {
      this.runner.run('kubectl', ['rollout', 'restart', 'deployment/playit', '-n', this.namespace], { quiet: true, allowFailure: true });
    }
    if (restartDiscordBot) {
      this.runner.run('kubectl', ['rollout', 'restart', 'deployment/discord-bot', '-n', this.namespace], { quiet: true });
    }
    const warnings = [
      this.waitForRollout('minecraft', '300s'),
      this.waitForRollout('playit', '180s'),
      this.waitForRollout('discord-bot', '180s'),
    ].filter(Boolean);

    return {
      changed: restartDiscordBot || restartPlayit,
      warning: warnings.length > 0,
      message: warnings.length > 0 ? `${warnings.join('; ')}; health verification follows` : 'Workload rollouts checked',
    };
  }
}
