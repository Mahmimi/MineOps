import { footer, header, print } from '../ui/printer.js';
import { green, icons, red, yellow } from '../ui/theme.js';

export const playitCommand = {
  name: 'playit',
  description: 'Show Playit tunnel health.',
  usage: 'mineops playit [--instance <name>|--all]',
  examples: ['mineops playit', 'mineops playit --instance survival', 'mineops playit --all'],
  execute({ args, services }) {
    const resolved = services.resolveTargets(args, { usage: this.usage, examples: this.examples, allowAll: true });
    for (const binding of resolved.bindings) {
      const playit = binding.kubernetes.playitState();
      header(`${icons.tunnel} Playit Tunnel (${binding.instance.name})`);
      print(`Agent: ${playit.agentReady ? green('Ready') : red(playit.state)}`);
      print(`Replicas: ${playit.ready} / ${playit.desired}`);
      print(`Minecraft endpoints: ${playit.minecraftEndpointCount}`);
      print(`Join path: ${playit.publicReady ? green('Ready') : yellow('Blocked')}`);
      print('');
      print(playit.reason);
      if (!playit.minecraftEndpointsReady) {
        print('');
        print(`Next: run mineops start minecraft --instance ${binding.instance.name}, then recheck mineops playit.`);
      }
      footer(`Playit Health: ${playit.publicReady ? green('HEALTHY') : yellow('DEGRADED')}`);
    }
  },
};
