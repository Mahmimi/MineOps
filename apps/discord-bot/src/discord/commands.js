import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { localDateTime } from '../../../utils/time.js';

const COLORS = {
  healthy: 0x2ecc71,
  warning: 0xf1c40f,
  critical: 0xd64545,
  info: 0x5865f2,
};

const ICON = {
  green: '\u{1F7E2}',
  yellow: '\u{1F7E1}',
  red: '\u{1F534}',
  uptime: '\u{23F1}',
  players: '\u{1F465}',
  backup: '\u{1F4BE}',
  game: '\u{1F3AE}',
  server: '\u{1F9F1}',
  memory: '\u{1F9E0}',
  world: '\u{1F30D}',
  sword: '\u{2694}',
  camp: '\u{1F3D5}',
  clock: '\u{1F552}',
  bot: '\u{1F916}',
  cluster: '\u{2638}',
  tunnel: '\u{1F310}',
  wrench: '\u{1F6E0}',
  alert: '\u{1F514}',
  event: '\u{23F1}',
  package: '\u{1F4E6}',
  check: '\u{2705}',
  warn: '\u{26A0}',
  info: '\u{2139}\u{FE0F}',
};

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

function severityIcon(severity = 'INFO') {
  if (severity === 'ERROR' || severity === 'CRITICAL') return ICON.red;
  if (severity === 'WARN' || severity === 'WARNING') return ICON.yellow;
  return ICON.green;
}

function eventLine(event) {
  return `${severityIcon(event.severity)} [${localDateTime(event.timestamp)}] ${event.message ?? 'Platform event'}`;
}

function statusColor(snapshot) {
  if (!snapshot.running) return COLORS.critical;
  if (snapshot.playit?.health !== 'READY' || snapshot.backup?.stale || snapshot.maintenance?.enabled) return COLORS.warning;
  return COLORS.healthy;
}

function baseEmbed(title, color = COLORS.info) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp(new Date())
    .setFooter({ text: 'MineOps Platform' });
}

function maintenanceNote(maintenance) {
  return maintenance?.enabled ? `\n\n${ICON.wrench} Maintenance mode is enabled.` : '';
}

function statusEmbed(status) {
  const server = status.server ?? {};
  const pod = status.primaryPod ?? {};
  const backup = status.backup ?? {};
  const playit = status.playit ?? {};

  if (!status.running) {
    return {
      embeds: [baseEmbed(`${ICON.red} MineOps Server Offline`, COLORS.critical)
        .setDescription(`Server is currently unavailable.${maintenanceNote(status.maintenance)}`)
        .addFields(
          { name: 'Last Seen', value: status.lastSeen ?? 'Unknown', inline: true },
          { name: `${ICON.tunnel} Playit`, value: playit.reason ?? 'Unknown', inline: false },
        )],
    };
  }

  const health = backup.stale || playit.health !== 'READY' ? `${ICON.warn} Needs attention` : `${ICON.check} Healthy`;
  return {
    embeds: [baseEmbed(`${ICON.green} MineOps Online`, statusColor(status))
      .setDescription(`${health}${maintenanceNote(status.maintenance)}`)
      .addFields(
        { name: `${ICON.uptime} Uptime`, value: pod.uptime ?? 'Unknown', inline: true },
        { name: `${ICON.players} Players`, value: playerCount(status.players), inline: true },
        { name: `${ICON.backup} Last Backup`, value: backup.lastBackupAge ?? 'Not available', inline: true },
        { name: `${ICON.game} Version`, value: `${titleCase(server.serverType)} ${titleCase(server.version)}`, inline: true },
        { name: `${ICON.tunnel} Playit`, value: playit.health === 'READY' ? 'Ready for public joins' : playit.reason ?? 'Unknown', inline: false },
      )],
  };
}

function dashboardEmbed(status) {
  const backupState = status.backup?.stale ? 'Needs attention' : 'Healthy';
  const maintenance = status.maintenance?.enabled ? 'Enabled' : 'Off';
  return {
    embeds: [baseEmbed(`${ICON.game} MineOps Dashboard`, statusColor(status))
      .addFields(
        { name: `${ICON.server} Minecraft`, value: status.running ? 'Online' : 'Offline', inline: true },
        { name: `${ICON.players} Players`, value: playerCount(status.players), inline: true },
        { name: `${ICON.uptime} Uptime`, value: status.primaryPod?.uptime ?? 'Unknown', inline: true },
        { name: `${ICON.backup} Backups`, value: `${backupState}\nLast: ${status.backup?.lastBackupAge ?? 'Not available'}`, inline: true },
        { name: `${ICON.bot} Discord`, value: 'Connected', inline: true },
        { name: `${ICON.tunnel} Playit`, value: status.playit?.health === 'READY' ? 'Ready' : status.playit?.reason ?? 'Unknown', inline: true },
        { name: `${ICON.cluster} Cluster`, value: 'Reachable', inline: true },
        { name: `${ICON.wrench} Maintenance`, value: maintenance, inline: true },
      )],
  };
}

function playersEmbed(players) {
  const title = players.available ? `${ICON.players} Online Players (${playerCount(players)})` : `${ICON.players} Online Players`;
  const description = !players.available
    ? 'Player information is temporarily unavailable.'
    : players.players.length === 0
      ? 'No players online right now.'
      : players.players.map((player) => `${ICON.green} ${player}`).join('\n');
  return { embeds: [baseEmbed(title, COLORS.info).setDescription(`${description}${maintenanceNote(players.maintenance)}`)] };
}

function serverEmbed(server) {
  const backup = server.backup ?? {};
  const playit = server.playit ?? {};
  const joinAddress = playit.publicJoinAddress ?? 'Set PLAYIT_JOIN_ADDRESS to show it here';
  return {
    embeds: [baseEmbed(`${ICON.server} MineOps Server`, COLORS.info)
      .addFields(
        { name: `${ICON.wrench} Type`, value: titleCase(server.serverType), inline: true },
        { name: `${ICON.package} Version`, value: titleCase(server.version), inline: true },
        { name: `${ICON.memory} Memory`, value: server.memory ?? 'Unknown', inline: true },
        { name: `${ICON.world} World`, value: server.world?.name ?? 'world', inline: true },
        { name: `${ICON.sword} Difficulty`, value: titleCase(server.difficulty), inline: true },
        { name: `${ICON.camp} Mode`, value: titleCase(server.mode), inline: true },
        { name: `${ICON.tunnel} Public Join`, value: joinAddress, inline: false },
        { name: `${ICON.tunnel} Playit Health`, value: playit.health === 'READY' ? 'Ready' : playit.reason ?? 'Unknown', inline: false },
        { name: `${ICON.backup} Backup Mode`, value: backup.mode ?? 'unknown', inline: true },
        { name: `${ICON.clock} Backup Interval`, value: backup.interval ?? 'unknown', inline: true },
        { name: `${ICON.wrench} Maintenance`, value: server.maintenance?.enabled ? 'Enabled' : 'Off', inline: true },
      )],
  };
}

function playitEmbed(playit) {
  const color = playit.health === 'READY' ? COLORS.healthy : COLORS.warning;
  const joinAddress = playit.publicJoinAddress ?? 'Set PLAYIT_JOIN_ADDRESS to show it here';
  return {
    embeds: [baseEmbed(`${ICON.tunnel} Playit Tunnel`, color)
      .setDescription(`${playit.reason ?? 'Playit status is unknown.'}${maintenanceNote(playit.maintenance)}`)
      .addFields(
        { name: 'Agent', value: playit.agentReady ? 'Ready' : titleCase(playit.state), inline: true },
        { name: 'Replicas', value: `${playit.readyReplicas ?? 0} / ${playit.desiredReplicas ?? 0}`, inline: true },
        { name: 'Minecraft Endpoints', value: playit.minecraftEndpointsReady ? `${playit.minecraftEndpointCount} ready` : 'None', inline: true },
        { name: 'Public Join', value: joinAddress, inline: false },
      )],
  };
}

function backupsEmbed(backup) {
  const jobs = backup.recentJobs ?? [];
  const description = jobs.length === 0
    ? 'No completed backups found yet.'
    : jobs.map((job) => `${ICON.package} ${job.name}\n${ICON.clock} ${localDateTime(job.completionTime ?? job.startTime)}`).join('\n');
  return {
    embeds: [baseEmbed(`${ICON.backup} Recent Backups`, backup.stale ? COLORS.warning : COLORS.info)
      .setDescription(description)
      .addFields(
        { name: 'Backup Mode', value: backup.mode ?? 'unknown', inline: true },
        { name: 'Retention', value: backup.retentionLimit === 'unknown' ? 'Configured by mode' : `${backup.retentionLimit} backups`, inline: true },
        { name: 'Last Backup', value: backup.lastBackupAge ?? 'Not available', inline: true },
      )],
  };
}

function eventsEmbed(events) {
  const description = events.length === 0
    ? 'No platform events recorded yet.'
    : events.slice(0, 5).map(eventLine).join('\n');
  return { embeds: [baseEmbed(`${ICON.event} Recent Events`, COLORS.info).setDescription(description)] };
}

function alertsEmbed(alerts) {
  const active = alerts.filter((alert) => !alert.resolved);
  const ordered = [...active, ...alerts.filter((alert) => alert.resolved)].slice(0, 5);
  const description = ordered.length === 0
    ? 'No active alerts.'
    : ordered.map((alert) => `${alert.resolved ? ICON.check : ICON.warn} ${alert.message ?? alert.type ?? 'Alert'}`).join('\n');
  return { embeds: [baseEmbed(`${ICON.alert} Active Alerts`, active.length > 0 ? COLORS.warning : COLORS.healthy).setDescription(description)] };
}

function helpEmbed() {
  return {
    embeds: [baseEmbed(`${ICON.game} MineOps Commands`, COLORS.info)
      .setDescription([
        '`/status` - Platform status overview',
        '`/server` - Minecraft configuration summary',
        '`/playit` - Public tunnel health and join path',
        '`/players` - Online player list',
        '`/dashboard` - Daily operational dashboard',
        '`/backups` - Recent backup inventory',
        '`/events` - Latest platform events',
        '`/alerts` - Active and recent alerts',
        '`/start_server` - Start Minecraft when offline',
        '`/stop_server` - Stop Minecraft, MineOps admin only',
        '`/restart_server` - Restart Minecraft, MineOps admin only',
        '`/help` - Command reference',
      ].join('\n'))],
  };
}

function lifecycleEmbed(result, color = COLORS.info) {
  return {
    embeds: [baseEmbed(`${result.changed ? ICON.check : ICON.info} ${result.title}`, color)
      .addFields(
        { name: 'Status', value: result.state ?? 'UNKNOWN', inline: true },
        { name: 'Result', value: result.message ?? 'Operation completed.', inline: false },
      )],
  };
}

function permissionDeniedEmbed() {
  return {
    embeds: [baseEmbed(`${ICON.red} Permission Denied`, COLORS.critical)
      .setDescription('You are not a MineOps administrator.')],
  };
}

function operationBlockedEmbed(error) {
  return {
    embeds: [baseEmbed(`${ICON.clock} Operation Blocked`, COLORS.warning)
      .setDescription(error.message || 'Another MineOps operation is currently in progress.')
      .addFields({ name: 'Try Again', value: 'Wait for the active operation to finish.', inline: false })],
  };
}

export const commandDefinitions = [
  new SlashCommandBuilder().setName('status').setDescription('Show MineOps server status.').toJSON(),
  new SlashCommandBuilder().setName('players').setDescription('Show online Minecraft players.').toJSON(),
  new SlashCommandBuilder().setName('server').setDescription('Show MineOps server information.').toJSON(),
  new SlashCommandBuilder().setName('playit').setDescription('Show Playit tunnel health.').toJSON(),
  new SlashCommandBuilder().setName('dashboard').setDescription('Show the MineOps operational dashboard.').toJSON(),
  new SlashCommandBuilder().setName('backups').setDescription('Show recent MineOps backups.').toJSON(),
  new SlashCommandBuilder().setName('events').setDescription('Show recent MineOps events.').toJSON(),
  new SlashCommandBuilder().setName('alerts').setDescription('Show active MineOps alerts.').toJSON(),
  new SlashCommandBuilder().setName('start_server').setDescription('Start the Minecraft server when it is offline.').toJSON(),
  new SlashCommandBuilder().setName('stop_server').setDescription('Stop the Minecraft server. MineOps administrators only.').toJSON(),
  new SlashCommandBuilder().setName('restart_server').setDescription('Restart the Minecraft server. MineOps administrators only.').toJSON(),
  new SlashCommandBuilder().setName('help').setDescription('Show MineOps command reference.').toJSON(),
];

export function createCommandHandlers({ platformService }) {
  async function lifecycle(handler, interaction) {
    try {
      const result = await handler({ user: interaction.user });
      return lifecycleEmbed(result, result.warning || result.state === 'STOPPED' ? COLORS.warning : COLORS.healthy);
    } catch (error) {
      if (error.code === 'MINEOPS_PERMISSION_DENIED') return permissionDeniedEmbed();
      if (error.code === 'MINEOPS_OPERATION_BLOCKED') return operationBlockedEmbed(error);
      throw error;
    }
  }

  return {
    status: async () => statusEmbed(await platformService.getStatus()),
    players: async () => playersEmbed(await platformService.getPlayers()),
    server: async () => serverEmbed(await platformService.getServer()),
    playit: async () => playitEmbed(await platformService.getPlayit()),
    dashboard: async () => dashboardEmbed(await platformService.getDashboard()),
    backups: async () => backupsEmbed(await platformService.getBackups()),
    events: async () => eventsEmbed(await platformService.getEvents({ limit: 5 })),
    alerts: async () => alertsEmbed(await platformService.getAlerts({ limit: 10, activeOnly: true })),
    start_server: async (interaction) => lifecycle(platformService.startServer.bind(platformService), interaction),
    stop_server: async (interaction) => lifecycle(platformService.stopServer.bind(platformService), interaction),
    restart_server: async (interaction) => lifecycle(platformService.restartServer.bind(platformService), interaction),
    help: async () => helpEmbed(),
  };
}
