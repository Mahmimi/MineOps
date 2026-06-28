import { fail, ok, print } from '../ui/printer.js';
import { green, yellow } from '../ui/theme.js';

function runChecks(binding, services, mineopsConfig) {
  const snapshot = binding.platform.snapshot();
  return [
    ['Cluster Reachable', snapshot.nodes.length > 0],
    ['Terraform State Healthy', binding.platform.terraformClean(mineopsConfig)],
    ['Minecraft Deployment Healthy', binding.kubernetes.deploymentState(binding.names.minecraftDeployment).state === 'ONLINE'],
    ['PVC Bound', binding.kubernetes.pvc(binding.names.minecraftPvc)?.status?.phase === 'Bound'],
    ['Discord Bot Connected', binding.kubernetes.deploymentState(binding.names.discordDeployment).state === 'ONLINE'],
    ['Playit Agent Connected', binding.kubernetes.playitState().agentReady],
    ['Playit Join Path Ready', binding.kubernetes.playitState().publicReady],
    ['Backup CronJob Healthy', Boolean(binding.kubernetes.cronJob(binding.names.backupCronJob))],
  ];
}

export const doctorCommand = {
  name: 'doctor',
  description: 'Run platform diagnostics.',
  usage: 'mineops doctor [--instance <name>|--all]',
  examples: ['mineops doctor', 'mineops doctor --instance survival', 'mineops doctor --all'],
  execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, allowAll: true });
    const mineopsConfig = resolved.mineopsConfig;
    print('Running Platform Diagnostics...');
    print('');
    let failures = 0;
    for (const binding of resolved.bindings) {
      if (resolved.bindings.length > 1) print(`${binding.instance.name} (${binding.instance.namespace})`);
      const checks = runChecks(binding, services, mineopsConfig);
      for (const [label, passed] of checks) {
        passed ? ok(label) : (fail(label), failures += 1);
      }
      if (resolved.bindings.length > 1) print('');
    }
    print('Result:');
    print(failures === 0 ? green('No issues found') : yellow(`${failures} issue(s) found`));
    if (failures > 0) process.exitCode = 1;
  },
};
