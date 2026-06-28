import { UserInputError } from '../domain/errors.js';
import { header, ok, print, warn } from '../ui/printer.js';

export const updateCommand = {
  name: 'update',
  description: 'Update MineOps managed runtime versions.',
  usage: 'mineops update minecraft <version> [--instance <name>]',
  examples: ['mineops update minecraft LATEST --instance survival', 'mineops update minecraft 1.21.1 --instance survival'],
  execute({ args, services }) {
    const [target, version, ...rest] = args;
    if (target !== 'minecraft' || !version) {
      throw new UserInputError('Invalid update command', { usage: this.usage, examples: this.examples });
    }

    const resolved = services.resolveTargets(rest, { usage: this.usage, examples: this.examples });
    const binding = resolved.bindings[0];
    const configVersion = binding.config.parse().minecraft?.version;
    const runtimeVersion = binding.config.runtimeDiff().find((row) => row.key === 'minecraft.version')?.actual;
    const current = runtimeVersion ?? configVersion;
    if (String(current).toLowerCase() === String(version).toLowerCase()) {
      if (String(configVersion).toLowerCase() !== String(version).toLowerCase()) {
        binding.config.setMinecraftVersion(version);
      }
      header(`Minecraft Already Up To Date (${binding.instance.name})`);
      print(`Version: ${current}`);
      return;
    }

    header(`Updating Minecraft (${binding.instance.name})`);
    print(`Current: ${current}`);
    print(`Target: ${version}`);
    print('');
    print('Creating backup before upgrade...');
    services.runner.run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', `${services.paths.root()}\\mineops.ps1`, 'backup', '--instance', binding.instance.name]);
    binding.config.setMinecraftVersion(version);
    binding.operations.setMinecraftVersion(version);
    const drift = binding.config.runtimeDiff().filter((row) => row.key === 'minecraft.version')[0];
    if (drift?.drift) {
      warn('Runtime version did not match config after restart. Use latest backup for rollback if needed.');
    }
    binding.data.appendEvent({ type: 'minecraft', severity: 'INFO', message: `Minecraft updated to ${version}` });
    ok('Minecraft update workflow completed');
  },
};
