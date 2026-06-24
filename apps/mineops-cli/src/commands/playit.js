import { footer, header, print } from '../ui/printer.js';
import { green, icons, red, yellow } from '../ui/theme.js';

export const playitCommand = {
  name: 'playit',
  description: 'Show Playit tunnel health.',
  usage: 'mineops playit',
  examples: ['mineops playit', 'mineops logs playit'],
  execute({ services }) {
    const playit = services.kubernetes.playitState();
    header(`${icons.tunnel} Playit Tunnel`);
    print(`Agent: ${playit.agentReady ? green('Ready') : red(playit.state)}`);
    print(`Replicas: ${playit.ready} / ${playit.desired}`);
    print(`Minecraft endpoints: ${playit.minecraftEndpointCount}`);
    print(`Join path: ${playit.publicReady ? green('Ready') : yellow('Blocked')}`);
    print('');
    print(playit.reason);
    if (!playit.minecraftEndpointsReady) {
      print('');
      print('Next: run mineops start minecraft, then recheck mineops playit.');
    }
    footer(`Playit Health: ${playit.publicReady ? green('HEALTHY') : yellow('DEGRADED')}`);
  },
};
