import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

function titleCase(value) {
  if (!value) return 'Unknown';
  return String(value)
    .toLowerCase()
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function playerCount(players) {
  if (!players?.available) return 'Unavailable';
  return `${players.onlineCount ?? 0} / ${players.maxPlayers ?? '?'}`;
}

function embed(title, color) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp(new Date())
    .setFooter({ text: 'MineOps' });
}

function statusEmbed(status) {
  const server = status.server ?? {};
  const pod = status.primaryPod ?? {};
  const backup = status.backup ?? {};

  if (!status.running) {
    return {
      embeds: [embed('🔴 MineOps Offline', 0xd64545)
        .setDescription('Server is currently unavailable.')
        .addFields({ name: 'Last Seen', value: status.lastSeen ?? 'Unknown', inline: false })],
    };
  }

  const healthLine = backup.stale ? '⚠️ Backup stale' : '✅ Healthy';
  const maintenanceLine = status.maintenance?.enabled ? '\n\n🛠 Maintenance mode is enabled.' : '';
  return {
    embeds: [embed('🟢 MineOps Online', 0x2ecc71)
      .setDescription(`${healthLine}${maintenanceLine}`)
      .addFields(
        { name: '⏱ Uptime', value: pod.uptime ?? 'Unknown', inline: true },
        { name: '👥 Players', value: playerCount(status.players), inline: true },
        { name: '📦 Last Backup', value: backup.lastBackupAge ?? 'Not available', inline: true },
        { name: '🎮 Version', value: `${titleCase(server.serverType)} ${titleCase(server.version)}`, inline: true },
      )],
  };
}

function playersEmbed(players) {
  const title = players.available ? `👥 Online Players (${playerCount(players)})` : '👥 Online Players';
  const description = !players.available
    ? 'Player information is temporarily unavailable.'
    : players.players.length === 0
      ? 'No players online right now.'
      : players.players.map((player) => `🟢 ${player}`).join('\n');
  return { embeds: [embed(title, 0x3498db).setDescription(description)] };
}

function serverEmbed(server) {
  const backup = server.backup ?? {};
  return {
    embeds: [embed('🧙 MineOps Server', 0x5865f2).addFields(
      { name: '🛠 Type', value: titleCase(server.serverType), inline: true },
      { name: '📦 Version', value: titleCase(server.version), inline: true },
      { name: '💾 Memory', value: server.memory ?? 'Unknown', inline: true },
      { name: '🌍 World', value: server.world?.name ?? 'world', inline: true },
      { name: '⚔ Difficulty', value: titleCase(server.difficulty), inline: true },
      { name: '🏕 Mode', value: titleCase(server.mode), inline: true },
      { name: '🗄 Backup Mode', value: backup.mode ?? 'unknown', inline: true },
      { name: '🕒 Backup Interval', value: backup.interval ?? 'unknown', inline: true },
      { name: '🛠 Maintenance', value: server.maintenance?.enabled ? 'Enabled' : 'Off', inline: true },
    )],
  };
}

export const commandDefinitions = [
  new SlashCommandBuilder().setName('status').setDescription('Show MineOps server status.').toJSON(),
  new SlashCommandBuilder().setName('players').setDescription('Show online Minecraft players.').toJSON(),
  new SlashCommandBuilder().setName('server').setDescription('Show MineOps server information.').toJSON(),
];

export function createCommandHandlers({ platformService }) {
  return {
    status: async () => statusEmbed(await platformService.getStatus()),
    players: async () => playersEmbed(await platformService.getPlayers()),
    server: async () => serverEmbed(await platformService.getServer()),
  };
}
