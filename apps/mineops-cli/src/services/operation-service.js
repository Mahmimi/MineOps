import { UserInputError } from '../domain/errors.js';

export class OperationService {
  constructor({ runner, namespace, dataService }) {
    this.runner = runner;
    this.namespace = namespace;
    this.dataService = dataService;
    this.backupCronJobName = 'minecraft-backup';
  }

  setBackupCronJobSuspended(suspend) {
    this.runner.run('kubectl', [
      'patch',
      'cronjob',
      this.backupCronJobName,
      '-n',
      this.namespace,
      '--type=merge',
      `-p={"spec":{"suspend":${suspend ? 'true' : 'false'}}}`,
    ]);
  }

  setMinecraftVersion(version) {
    this.runner.run('kubectl', ['set', 'env', 'deployment/minecraft', '-n', this.namespace, `VERSION=${version}`]);
    const state = this.runner.run('kubectl', ['get', 'deployment/minecraft', '-n', this.namespace, '-o', 'jsonpath={.spec.replicas}'], {
      capture: true,
      allowFailure: true,
    });
    if (state.status === 0 && Number.parseInt(state.stdout, 10) > 0) {
      this.runner.run('kubectl', ['rollout', 'status', 'deployment/minecraft', '-n', this.namespace, '--timeout=300s']);
    }
  }

  scale(name, replicas) {
    if (name === 'minecraft' && replicas === 0) {
      this.setBackupCronJobSuspended(true);
    }

    this.runner.run('kubectl', ['scale', `deployment/${name}`, '-n', this.namespace, `--replicas=${replicas}`]);
    if (replicas > 0) {
      this.runner.run('kubectl', ['rollout', 'status', `deployment/${name}`, '-n', this.namespace, '--timeout=300s']);
      if (name === 'minecraft') this.setBackupCronJobSuspended(false);
    } else {
      this.runner.run('kubectl', [
        'wait',
        '--for=delete',
        'pod',
        '-l',
        'app.kubernetes.io/name=minecraft',
        '-n',
        this.namespace,
        '--timeout=300s',
      ]);
    }
    this.dataService.appendEvent({ type: 'minecraft', severity: 'INFO', message: `${name} scaled to ${replicas}` });
  }

  restart(target) {
    if (target !== 'minecraft') {
      throw new UserInputError('Unsupported restart target', {
        usage: 'mineops restart minecraft',
        examples: ['mineops restart minecraft'],
      });
    }
    this.runner.run('kubectl', ['rollout', 'restart', `deployment/${target}`, '-n', this.namespace]);
    this.runner.run('kubectl', ['rollout', 'status', `deployment/${target}`, '-n', this.namespace, '--timeout=300s']);
    this.dataService.appendEvent({ type: 'minecraft', severity: 'INFO', message: `${target} restarted` });
  }
}
