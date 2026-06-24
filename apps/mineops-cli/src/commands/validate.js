import { header, ok, print, warn } from '../ui/printer.js';

export const validateCommand = {
  name: 'validate',
  description: 'Validate MineOps configuration and world metadata.',
  usage: 'mineops validate',
  examples: ['mineops validate'],
  execute({ services }) {
    header('MineOps Configuration Validation');
    services.config.validate();
    ok('config/minecraft.yaml is valid');
    const warnings = services.config.worldMetadataWarnings();
    if (warnings.length > 0) {
      print('');
      for (const item of warnings) warn(item);
    }
  },
};
