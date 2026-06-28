import { header, ok, print, warn } from '../ui/printer.js';

export const validateCommand = {
  name: 'validate',
  description: 'Validate MineOps configuration and world metadata.',
  usage: 'mineops validate [--instance <name>|--all]',
  examples: ['mineops validate', 'mineops validate --instance survival', 'mineops validate --all'],
  execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, allowAll: true });
    header('MineOps Configuration Validation');
    services.loadMineOpsConfig();
    ok('MineOpsConfig is valid');
    for (const binding of resolved.bindings) {
      const warnings = binding.config.worldMetadataWarnings();
      print('');
      print(`${binding.instance.name} (${binding.instance.namespace})`);
      if (warnings.length === 0) {
        ok('World metadata matches configuration');
      } else {
        for (const item of warnings) warn(item);
      }
    }
  },
};
