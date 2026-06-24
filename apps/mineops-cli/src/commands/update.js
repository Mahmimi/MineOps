import { UserInputError } from '../domain/errors.js';
import { header, ok, print, warn } from '../ui/printer.js';

export const updateCommand = {
  name: 'update',
  description: 'Update MineOps managed runtime versions.',
  usage: 'mineops update minecraft <version>',
  examples: ['mineops update minecraft LATEST', 'mineops update minecraft 1.21.1'],
  execute({ args, services }) {
    const [target, version] = args;
    if (target !== 'minecraft' || !version) {
      throw new UserInputError('Invalid update command', { usage: this.usage, examples: this.examples });
    }

    const current = services.config.parse().minecraft?.version;
    if (String(current).toLowerCase() === String(version).toLowerCase()) {
      header('Minecraft Already Up To Date');
      print(`Version: ${current}`);
      return;
    }

    header('Updating Minecraft');
    print(`Current: ${current}`);
    print(`Target: ${version}`);
    print('');
    print('Creating backup before upgrade...');
    services.runner.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${services.paths.root()}\\mineops.ps1`, 'backup']);
    services.config.setMinecraftVersion(version);
    services.runner.run('terraform', ['apply', '-auto-approve'], { cwd: services.paths.terraform() });
    services.operations.restart('minecraft');
    const drift = services.config.runtimeDiff().filter((row) => row.key === 'minecraft.version')[0];
    if (drift?.drift) {
      warn('Runtime version did not match config after restart. Use latest backup for rollback if needed.');
    }
    services.data.appendEvent({ type: 'minecraft', severity: 'INFO', message: `Minecraft updated to ${version}` });
    ok('Minecraft update workflow completed');
  },
};
