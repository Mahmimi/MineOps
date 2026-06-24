import { UserInputError } from '../domain/errors.js';

export class OperationService {
  constructor({ runner, namespace, dataService }) {
    this.runner = runner;
    this.namespace = namespace;
    this.dataService = dataService;
  }

  scale(name, replicas) {
    this.runner.run('kubectl', ['scale', `deployment/${name}`, '-n', this.namespace, `--replicas=${replicas}`]);
    if (replicas > 0) {
      this.runner.run('kubectl', ['rollout', 'status', `deployment/${name}`, '-n', this.namespace, '--timeout=300s']);
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
