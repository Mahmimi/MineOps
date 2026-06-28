import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import { commandDefinitions, createCommandHandlers } from './commands.js';
import { startAlertingService } from '../platform/alerting-service.js';
import { AlertHistoryStore } from '../platform/alert-history-store.js';
import { DiscordAlertProvider } from '../platform/alert-provider.js';
import { KubernetesMetricsProvider } from '../platform/metrics-provider.js';

async function registerCommands({ config, logger }) {
  if (!config.discord.registerCommands) {
    logger.info('discord command registration disabled');
    return;
  }

  if (!config.discord.clientId) {
    logger.warn('discord command registration skipped because DISCORD_CLIENT_ID is not set');
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.discord.token);
  const route = config.discord.guildId
    ? Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId)
    : Routes.applicationCommands(config.discord.clientId);

  await rest.put(route, { body: commandDefinitions });
  logger.info('discord slash commands registered', { commandCount: commandDefinitions.length, scope: config.discord.guildId ? 'guild' : 'global' });
}

function interactionAllowedInChannel(interaction, config) {
  const commandChannelId = config.discord.commandChannelId?.trim?.() ?? '';
  if (!commandChannelId) return true;
  return interaction.channelId === commandChannelId;
}

export async function startDiscordBot({ config, logger, runtimeState, platformService, stateStore }) {
  if (!config.discord.enabled) {
    logger.warn('discord gateway disabled because DISCORD_TOKEN is empty or placeholder');
    return null;
  }

  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const handlers = createCommandHandlers({ platformService });
  let alertingService = null;

  client.once(Events.ClientReady, async (readyClient) => {
    runtimeState.discordConnected = true;
    logger.info('discord client ready', {
      userTag: readyClient.user.tag,
      userId: readyClient.user.id,
      commandChannelId: config.discord.commandChannelId || null,
    });

    try {
      await registerCommands({ config, logger });
    } catch (error) {
      logger.error('discord command registration failed', { error: error.message });
    }

    alertingService = startAlertingService({
      config,
      logger,
      alertProvider: config.discord.alertChannelId ? new DiscordAlertProvider({ client, channelId: config.discord.alertChannelId }) : null,
      metricsProvider: new KubernetesMetricsProvider({ platformService }),
      historyStore: new AlertHistoryStore({ logger }),
      stateStore,
    });
  });

  client.on(Events.ShardDisconnect, () => {
    runtimeState.discordConnected = false;
    logger.warn('discord shard disconnected');
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (!interactionAllowedInChannel(interaction, config)) {
      logger.info('discord command ignored for unmatched channel', {
        command: interaction.commandName,
        channelId: interaction.channelId,
        commandChannelId: config.discord.commandChannelId || null,
      });
      return;
    }

    const handler = handlers[interaction.commandName];
    if (!handler) return;

    const startedAt = Date.now();
    try {
      await interaction.deferReply({ ephemeral: true });
      const reply = await handler(interaction);
      if (typeof reply === 'string') await interaction.editReply({ content: reply });
      else await interaction.editReply(reply);
      logger.info('discord command handled', { command: interaction.commandName, durationMs: Date.now() - startedAt });
    } catch (error) {
      logger.error('discord command failed', { command: interaction.commandName, error: error.message });
      const message = 'MineOps could not read the requested status. Check bot logs for details.';
      if (interaction.deferred || interaction.replied) await interaction.editReply({ content: message });
      else await interaction.reply({ content: message, ephemeral: true });
    }
  });

  client.stopMineOpsAlerting = () => { alertingService?.stop(); };
  await client.login(config.discord.token);
  logger.info('discord login requested');
  return client;
}
