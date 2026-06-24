import { UserInputError } from '../domain/errors.js';
import { header, ok, print } from '../ui/printer.js';

export const importCommand = {
  name: 'import',
  description: 'Import existing Minecraft world data into the minecraft-data PVC.',
  usage: 'mineops import world <path>',
  examples: ['mineops import world "D:\\minecraft-server\\data"'],
  execute({ args, services }) {
    const [type, ...pathParts] = args;
    if (type !== 'world' || pathParts.length === 0) {
      throw new UserInputError('Invalid import command', {
        usage: this.usage,
        examples: this.examples,
      });
    }

    const source = pathParts.join(' ');
    const result = services.worldImport.importWorld(source);
    header('Minecraft World Imported');
    print(`Source: ${result.source}`);
    print(`World: ${result.worldName}`);
    print(`Files Copied: ${result.files}`);
    print('PVC: minecraft-data');
    print('');
    ok('Result: Success');
  },
};
