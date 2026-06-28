import { fail, footer, header, ok, print, warn } from '../ui/printer.js';

function printStep(event) {
  if (event.phase === 'start') {
    print(`... ${event.name}`);
    return;
  }

  const label = `${event.name}${event.message ? `: ${event.message}` : ''}`;
  if (event.phase === 'error') {
    fail(label);
  } else if (event.status === 'OK') {
    ok(label);
  } else if (event.status === 'SKIPPED') {
    warn(`Skipped ${label}`);
  } else if (event.status === 'WARN') {
    warn(label);
  } else {
    ok(label);
  }
}

function printInstanceSummary(instance) {
  print(`${instance.name} (${instance.namespace})`);
  print(`  Minecraft: ${instance.minecraft.state} (${instance.minecraft.ready ?? 0}/${instance.minecraft.desired ?? 0})`);
  print(`  Playit: ${instance.playit.publicReady ? 'READY' : instance.playit.reason}`);
  print(`  Discord Bot: ${instance.discord.state} (${instance.discord.ready ?? 0}/${instance.discord.desired ?? 0})`);
  print(`  Backup CronJob: ${instance.backupCronJobReady ? 'READY' : 'MISSING'}`);
}

export const initCommand = {
  name: 'init',
  description: 'Initialize or reconcile the MineOps platform.',
  usage: 'mineops init',
  examples: ['mineops init'],
  execute({ services }) {
    header('Initializing MineOps');
    const mineopsConfig = services.loadMineOpsConfig();
    services.runner.setBaseEnv(mineopsConfig.globals.env);
    const report = services.deployment.run({ onStep: printStep, mineopsConfig });

    print('');
    print('Deployment Summary');
    if (report.health.instances?.length > 1) {
      for (const instance of report.health.instances) printInstanceSummary(instance);
    } else {
      print(`Minecraft: ${report.health.minecraft.state} (${report.health.minecraft.ready ?? 0}/${report.health.minecraft.desired ?? 0})`);
      print(`Playit: ${report.health.playit.publicReady ? 'READY' : report.health.playit.reason}`);
      print(`Discord Bot: ${report.health.discord.state} (${report.health.discord.ready ?? 0}/${report.health.discord.desired ?? 0})`);
      print(`Backup CronJob: ${report.health.backupCronJobReady ? 'READY' : 'MISSING'}`);
    }

    if (!report.health.healthy) {
      fail('MineOps initialized with warnings');
      process.exitCode = 1;
      return;
    }

    footer('MineOps is ready');
  },
};