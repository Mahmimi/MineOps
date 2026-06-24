import { timelineCommand } from './timeline.js';

export const eventsCommand = {
  ...timelineCommand,
  name: 'events',
  description: 'Show recent platform events.',
  usage: 'mineops events [--type backup|deployment|maintenance|minecraft|platform|alerts]',
  examples: [
    'mineops events',
    'mineops events --type backup',
    'mineops events --type minecraft',
  ],
};
