import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { startHealthServer } from './health.js';
import { startDiscordBot } from './discord/bot.js';
import { KubernetesStatusProvider } from './platform/kubernetes-status-provider.js';
import { MinecraftQueryProvider } from './platform/minecraft-query-provider.js';
import { MineOpsPlatformService } from './platform/mineops-platform-service.js';

const config = loadConfig();
const logger = createLogger({ serviceName: config.serviceName, level: config.logLevel });
const runtimeState = {
  discordConnected: false,
};

logger.info('mineops discord bot starting', {
  namespace: config.mineops.namespace,
  discordEnabled: config.discord.enabled,
  discordRequired: config.discord.required,
});

const statusProvider = new KubernetesStatusProvider({ config, logger });
const playerProvider = new MinecraftQueryProvider({ config, logger });
const platformService = new MineOpsPlatformService({ statusProvider, playerProvider });
const healthServer = startHealthServer({ config, logger, runtimeState, platformService });
const discordClient = await startDiscordBot({ config, logger, runtimeState, platformService });

async function shutdown(signal) {
  logger.info('shutdown requested', { signal });

  if (discordClient) {
    discordClient.destroy();
  }

  healthServer.close(() => {
    logger.info('health server stopped');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('forced shutdown timeout reached');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
