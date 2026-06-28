import { UserInputError } from '../domain/errors.js';
import { header, ok, print } from '../ui/printer.js';

function parseImportArgs(args) {
  if (args[0] === 'world' && args.length > 1) {
    return { source: args.slice(1).join(' ') };
  }

  let source = null;
  let worldOnly = false;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--source') {
      source = args[index + 1];
      index += 1;
      continue;
    }
    if (arg.startsWith('--source=')) {
      source = arg.slice('--source='.length);
      continue;
    }
    if (arg === '--world-only') {
      worldOnly = true;
    }
  }

  return { source, worldOnly };
}

export const importCommand = {
  name: 'import',
  description: 'Import existing Minecraft world data into an instance PVC.',
  usage: 'mineops import --instance <name> --source <path> [--world-only]',
  examples: ['mineops import --instance survival --source migrate/mineops-minecraft-data-old', 'mineops import --instance gameguys --source migrate/tao-server/world --world-only'],
  async execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, requireExplicitInstance: true });
    const binding = resolved.bindings[0];
    const parsed = parseImportArgs(resolved.args);
    if (!parsed.source) {
      throw new UserInputError('Import source is required', { usage: this.usage, examples: this.examples });
    }

    header(`Importing Minecraft World (${binding.instance.name})`);
    const result = await binding.worldImport.importWorld(parsed.source, {
      onStep: (message) => print(message),
    });

    print('');
    header('Minecraft World Imported');
    print(`Instance: ${binding.instance.name}`);
    print(`Namespace: ${binding.instance.namespace}`);
    print(`Source: ${result.source}`);
    print(`Copied From: ${result.copySource}`);
    print(`World: ${result.worldName}`);
    print(`Files Copied: ${result.files}`);
    print(`PVC: ${binding.names.minecraftPvc}`);
    print('');
    ok('Result: Success');
  },
};
