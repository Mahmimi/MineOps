import { SlashCommandBuilder } from 'discord.js';

function yesNo(value) {
  return value ? 'yes' : 'no';
}

function titleCase(value) {
  if (!value) return 'Unknown';
  return String(value)
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPlayerCount(players) {
  if (!players?.available) {
    return 'Unavailable';
  }

  return `${players.onlineCount ?? 0} / ${players.maxPlayers ?? '?'}`;
}

function formatStatusLabel(running) {
  return running ? '🟢 Online' : '🔴 Offline';
}

function formatStatus(status) {
  const server = status.server ?? {};
  const primaryPod = status.primaryPod ?? {};

  return [
    '### MineOps Server Status',
    '',
    formatStatusLabel(status.running),
    '',
    '**Status**',
    formatStatusLabel(status.running),
    '',
    '**Uptime**',
    primaryPod.uptime ?? 'Not running',
    '',
    '**Players**',
    formatPlayerCount(status.players),
    '',
    '**Version**',
    server.version ?? 'Unknown',
    '',
    '**Game Mode**',
    titleCase(server.mode),
  ].join('\n');
}

function formatPlayers(players) {
  if (!players.available) {
    return [
      '### Online Players',
      '',
      '⚪ Unavailable',
      '',
      '**Players Online**',
      'Unavailable',
      '',
      'Player information is temporarily unavailable.',
    ].join('\n');
  }

  const playerLines = players.players.length === 0
    ? ['No players online right now']
    : players.players.map((player) => `• ${player}`);

  return [
    '### Online Players',
    '',
    formatPlayerCount(players),
    '',
    '**Players Online**',
    formatPlayerCount(players),
    '',
    ...playerLines,
  ].join('\n');
}

function formatServer(server) {
  return [
    '### MineOps Server Info',
    '',
    `🧱 ${titleCase(server.serverType)}`,
    '',
    '**Type**',
    titleCase(server.serverType),
    '',
    '**Version**',
    server.version ?? 'Unknown',
    '',
    '**Memory**',
    server.memory ?? 'Unknown',
    '',
    '**Mode**',
    titleCase(server.mode),
    '',
    '**Difficulty**',
    titleCase(server.difficulty),
    '',
    '**World**',
    server.world.name,
    '',
    '**Join Address**',
    'Use your Playit address',
  ].join('\n');
}

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Show read-only MineOps Minecraft runtime status.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('players')
    .setDescription('Show read-only Minecraft player information if available.')
    .toJSON(),
  new SlashCommandBuilder()
    .setName('server')
    .setDescription('Show read-only Minecraft server configuration and endpoint information.')
    .toJSON(),
];

export function createCommandHandlers({ platformService }) {
  return {
    status: async () => formatStatus(await platformService.getStatus()),
    players: async () => formatPlayers(await platformService.getPlayers()),
    server: async () => formatServer(await platformService.getServer()),
  };
}
