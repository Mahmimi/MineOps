import { fail, ok, print } from '../ui/printer.js';

export const doctorCommand = {
  name: 'doctor',
  description: 'Run platform diagnostics.',
  usage: 'mineops doctor',
  examples: ['mineops doctor'],
  execute({ services }) {
    print('Running Platform Diagnostics...');
    print('');
    const nodes = services.platform.snapshot().nodes;
    if (nodes.length > 0 && !services.kubernetes.json(['get', 'namespace', 'mineops'])) {
      ok('Cluster Reachable');
      print('');
      print('MineOps is not deployed yet.');
      print('Next: run mineops init');
      return;
    }
    const checks = [
      ['Cluster Reachable', () => nodes.length > 0],
      ['Terraform State Healthy', () => services.platform.terraformClean()],
      ['Minecraft Deployment Healthy', () => services.kubernetes.deploymentState('minecraft').state === 'ONLINE'],
      ['PVC Bound', () => services.kubernetes.pvc('minecraft-data')?.status?.phase === 'Bound'],
      ['Discord Bot Connected', () => services.kubernetes.deploymentState('discord-bot').state === 'ONLINE'],
      ['Playit Agent Connected', () => services.kubernetes.playitState().agentReady],
      ['Playit Join Path Ready', () => services.kubernetes.playitState().publicReady],
      ['Backup CronJob Healthy', () => Boolean(services.kubernetes.cronJob('minecraft-backup'))],
    ];
    let failures = 0;
    for (const [label, check] of checks) {
      try { check() ? ok(label) : (fail(label), failures++); } catch { fail(label); failures++; }
    }
    print('');
    print('Result:');
    print(failures === 0 ? 'No issues found' : `${failures} issue(s) found`);
    if (failures > 0) process.exitCode = 1;
  },
};
