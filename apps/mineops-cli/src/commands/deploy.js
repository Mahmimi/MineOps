import { footer, header, ok, print } from '../ui/printer.js';

function runStep(label, action) {
  print(label);
  action();
  ok(label.replace(/^\[\d+\/\d+\]\s*/, ''));
  print('');
}

export const deployCommand = {
  name: 'deploy',
  description: 'Deploy MineOps through the operator workflow.',
  usage: 'mineops deploy',
  examples: ['mineops deploy'],
  execute({ services, constants }) {
    header('Deploying MineOps');

    runStep('[1/6] Building Discord Bot image', () => {
      services.runner.run('docker', ['build', '-t', constants.botImage, services.paths.discordBot()], { quiet: true });
    });

    runStep('[2/6] Importing image into k3d', () => {
      const nodes = services.runner.run('docker', ['ps', '--format', '{{.Names}}'], { capture: true, allowFailure: true });
      for (const node of nodes.stdout.split(/\r?\n/).filter((name) => /^k3d-mineops-local-(server|agent)-/.test(name))) {
        services.runner.run('docker', ['exec', node, 'crictl', 'rmi', `docker.io/library/${constants.botImage}`], { quiet: true, allowFailure: true });
      }
      services.runner.run('k3d', ['image', 'import', constants.botImage, '-c', constants.cluster], { quiet: true });
    });

    runStep('[3/6] Applying Terraform infrastructure', () => {
      services.runner.run('terraform', ['init', '-input=false', '-no-color'], {
        cwd: services.paths.terraform(),
        quiet: true,
        env: { TF_IN_AUTOMATION: '1' },
      });
      services.runner.run('terraform', ['apply', '-auto-approve', '-input=false', '-no-color'], {
        cwd: services.paths.terraform(),
        quiet: true,
        env: { TF_IN_AUTOMATION: '1' },
      });
    });

    runStep('[4/6] Bootstrapping Kubernetes secrets', () => {
      services.runner.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', services.paths.script('bootstrap-secrets.ps1')], { quiet: true });
    });

    runStep('[5/6] Applying platform manifests', () => {
      services.runner.run('kubectl', ['apply', '-f', services.paths.discordManifests(), '--recursive'], { quiet: true });
    });

    runStep('[6/6] Waiting for workloads', () => {
      services.runner.run('kubectl', ['rollout', 'restart', 'deployment/playit', '-n', constants.namespace], { quiet: true, allowFailure: true });
      services.runner.run('kubectl', ['rollout', 'status', 'deployment/playit', '-n', constants.namespace, '--timeout=180s'], { quiet: true, allowFailure: true });
      services.runner.run('kubectl', ['rollout', 'restart', 'deployment/discord-bot', '-n', constants.namespace], { quiet: true });
      services.runner.run('kubectl', ['rollout', 'status', 'deployment/discord-bot', '-n', constants.namespace, '--timeout=180s'], { quiet: true });
    });

    services.data.appendEvent({ type: 'deployment', severity: 'INFO', message: 'MineOps deployed' });
    footer('Overall Result: DEPLOYMENT SUCCESSFUL');
  },
};
