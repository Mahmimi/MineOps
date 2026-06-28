import { UserInputError } from '../domain/errors.js';
import { resourceNamesFor } from '../domain/resource-names.js';

export class OperationService {
  constructor({ runner, dataService }) {
    this.runner = runner;
    this.dataService = dataService;
  }

  setBackupCronJobSuspended(instance, suspend) {
    const names = resourceNamesFor(instance);
    this.runner.run('kubectl', [
      'patch',
      'cronjob',
      names.backupCronJob,
      '-n',
      instance.namespace,
      '--type=merge',
      `-p={"spec":{"suspend":${suspend ? 'true' : 'false'}}}`,
    ]);
  }

  setMinecraftVersion(instance, version) {
    const names = resourceNamesFor(instance);
    this.runner.run('kubectl', ['set', 'env', `deployment/${names.minecraftDeployment}`, '-n', instance.namespace, `VERSION=${version}`]);
    const state = this.runner.run('kubectl', ['get', `deployment/${names.minecraftDeployment}`, '-n', instance.namespace, '-o', 'jsonpath={.spec.replicas}'], {
      capture: true,
      allowFailure: true,
    });
    if (state.status === 0 && Number.parseInt(state.stdout, 10) > 0) {
      this.runner.run('kubectl', ['rollout', 'status', `deployment/${names.minecraftDeployment}`, '-n', instance.namespace, '--timeout=300s']);
    }
  }

  scale(instance, name, replicas) {
    const names = resourceNamesFor(instance);
    if (name !== names.minecraftDeployment) {
      throw new UserInputError('Unsupported scale target', {
        usage: 'mineops start minecraft --instance <name>\nmineops stop minecraft --instance <name>',
        examples: ['mineops start minecraft --instance survival', 'mineops stop minecraft --instance survival'],
      });
    }

    if (replicas === 0) {
      this.setBackupCronJobSuspended(instance, true);
    }

    this.runner.run('kubectl', ['scale', `deployment/${name}`, '-n', instance.namespace, `--replicas=${replicas}`]);
    if (replicas > 0) {
      this.runner.run('kubectl', ['rollout', 'status', `deployment/${name}`, '-n', instance.namespace, '--timeout=300s']);
      this.setBackupCronJobSuspended(instance, false);
    } else {
      this.runner.run('kubectl', [
        'wait',
        '--for=delete',
        'pod',
        '-l',
        names.minecraftSelector,
        '-n',
        instance.namespace,
        '--timeout=300s',
      ]);
    }
    this.dataService.appendEvent(instance, { type: 'minecraft', severity: 'INFO', message: `${name} scaled to ${replicas}` });
  }

  restart(instance, target) {
    const names = resourceNamesFor(instance);
    if (target !== names.minecraftDeployment) {
      throw new UserInputError('Unsupported restart target', {
        usage: 'mineops restart minecraft --instance <name>',
        examples: ['mineops restart minecraft --instance survival'],
      });
    }
    this.runner.run('kubectl', ['rollout', 'restart', `deployment/${target}`, '-n', instance.namespace]);
    this.runner.run('kubectl', ['rollout', 'status', `deployment/${target}`, '-n', instance.namespace, '--timeout=300s']);
    this.dataService.appendEvent(instance, { type: 'minecraft', severity: 'INFO', message: `${target} restarted` });
  }
}
