import { loadConfig } from './config.js';
import { createLogger } from './logger.js';
import { startHealthServer } from './health.js';
import { startDiscordBot } from './discord/bot.js';
import { KubernetesStatusProvider } from './platform/kubernetes-status-provider.js';
import { MinecraftQueryProvider } from './platform/minecraft-query-provider.js';
import { MineOpsPlatformService } from './platform/mineops-platform-service.js';
import { PlatformStateStore } from './platform/platform-state-store.js';
import { AdminAuthorizationService } from './platform/admin-authorization-service.js';
import { OperationLockService } from './platform/operation-lock-service.js';
import { ServerLifecycleService } from './platform/server-lifecycle-service.js';

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
const stateStore = new PlatformStateStore({ logger });
const lockService = new OperationLockService({ stateStore, timeoutMs: config.lifecycle.operationTimeoutMs });
const adminAuthorizationService = new AdminAuthorizationService({ config, logger });
const lifecycleService = new ServerLifecycleService({ config, statusProvider, playerProvider, stateStore, lockService, logger });
const platformService = new MineOpsPlatformService({ statusProvider, playerProvider, stateStore, lifecycleService, adminAuthorizationService });
const healthServer = startHealthServer({ config, logger, runtimeState, platformService });
const discordClient = await startDiscordBot({ config, logger, runtimeState, platformService, stateStore });
platformService.startIdleMonitor();

async function shutdown(signal) {
  logger.info('shutdown requested', { signal });

  if (discordClient) {
    discordClient.stopMineOpsAlerting?.();
    discordClient.destroy();
  }
  platformService.stopIdleMonitor();

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

