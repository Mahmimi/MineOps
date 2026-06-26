import { EmbedBuilder } from 'discord.js';
import { localDateTime } from '../../../utils/time.js';

const COLORS = {
  INFO: 0x5865f2,
  WARN: 0xf1c40f,
  WARNING: 0xf1c40f,
  ERROR: 0xd64545,
  CRITICAL: 0xd64545,
};

const ICONS = {
  INFO: '\u2139\ufe0f',
  WARN: '\u26a0\ufe0f',
  WARNING: '\u26a0\ufe0f',
  ERROR: '\u{1F534}',
  CRITICAL: '\u{1F534}',
  RESOLVED: '\u2705',
};

function formatDateTime(value = new Date()) {
  return localDateTime(value);
}

function severityColor(severity = 'INFO', status = 'ACTIVE') {
  if (status === 'RESOLVED') return 0x2ecc71;
  return COLORS[String(severity).toUpperCase()] ?? COLORS.INFO;
}

function severityIcon(severity = 'INFO', status = 'ACTIVE') {
  if (status === 'RESOLVED') return ICONS.RESOLVED;
  return ICONS[String(severity).toUpperCase()] ?? ICONS.INFO;
}

function field(name, value, inline = true) {
  return {
    name,
    value: value == null || value === '' ? 'Unknown' : String(value),
    inline,
  };
}

export class AlertProvider {
  async publish() {
    throw new Error('AlertProvider.publish must be implemented');
  }
}

export class DiscordAlertProvider extends AlertProvider {
  constructor({ client, channelId }) {
    super();
    this.client = client;
    this.channelId = channelId;
  }

  buildEmbed(alert) {
    const status = alert.status ?? (alert.resolved ? 'RESOLVED' : 'ACTIVE');
    const severity = alert.severity ?? (status === 'RESOLVED' ? 'INFO' : 'WARN');
    const title = status === 'RESOLVED'
      ? `${severityIcon(severity, status)} ${alert.recoveryTitle ?? `${alert.title ?? 'MineOps Alert'} Recovered`}`
      : `${severityIcon(severity, status)} ${alert.title ?? 'MineOps Alert'}`;
    const timeLabel = status === 'RESOLVED' ? 'Recovered At' : 'Time';
    const timeValue = status === 'RESOLVED'
      ? formatDateTime(alert.resolvedAt ?? alert.timestamp)
      : formatDateTime(alert.startedAt ?? alert.timestamp);

    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(severityColor(severity, status))
      .addFields(
        field('Status', status),
        field(timeLabel, timeValue),
      )
      .setTimestamp(new Date())
      .setFooter({ text: 'MineOps Platform Alerts' });

    if (status === 'RESOLVED') {
      embed.addFields(field('Downtime', alert.duration ?? 'Unknown'));
    } else {
      embed.addFields(field('Reason', alert.reason ?? alert.message ?? 'No reason provided', false));
    }

    if (alert.details && typeof alert.details === 'object') {
      for (const [key, value] of Object.entries(alert.details)) {
        embed.addFields(field(key, value));
      }
    }

    return embed;
  }

  async publish(alert) {
    const channel = await this.client.channels.fetch(this.channelId);
    if (!channel?.isTextBased()) {
      throw new Error('configured Discord alert channel is not text-based');
    }
    await channel.send({ embeds: [this.buildEmbed(alert)] });
  }
}
