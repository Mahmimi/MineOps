function formatTimestamp(date = new Date()) {
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

function formatDuration(startedAt) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes} minutes`;
}

export function startAlertingService({ config, logger, alertProvider, metricsProvider, historyStore, stateStore }) {
  if (!config.monitoring.enabled) {
    logger.info('monitoring alert loop disabled');
    return null;
  }

  if (!alertProvider) {
    logger.warn('discord alert channel disabled because DISCORD_ALERT_CHANNEL_ID is empty');
  }

  const active = new Map();

  async function publish(message) {
    if (!alertProvider) return;
    await alertProvider.publish(message);
  }

  async function raise(key, alert, recovery) {
    if (alert.active) {
      if (active.has(key)) return;
      active.set(key, { startedAt: Date.now(), recovery });
      await publish(alert.message);
      historyStore?.append({ type: key, severity: alert.severity ?? 'WARN', message: alert.summary, resolved: false });
      stateStore?.appendEvent({ type: 'alert', severity: alert.severity ?? 'WARN', message: alert.summary });
      logger.warn('mineops alert raised', { key });
      return;
    }

    const incident = active.get(key);
    if (!incident) return;
    active.delete(key);
    await publish(incident.recovery(incident.startedAt));
    historyStore?.append({ type: key, severity: 'INFO', message: alert.recoverySummary ?? `${key} recovered`, resolved: true });
    stateStore?.appendEvent({ type: 'alert', severity: 'INFO', message: alert.recoverySummary ?? `${key} recovered` });
    logger.info('mineops alert recovered', { key });
  }

  async function evaluate() {
    const snapshot = await metricsProvider.getSnapshot();
    if (snapshot.maintenance?.enabled) {
      logger.info('alert evaluation muted by maintenance mode');
      return;
    }

    await raise('minecraft-offline', {
      active: !snapshot.running,
      severity: 'WARN',
      summary: 'Minecraft offline',
      recoverySummary: 'Minecraft recovered',
      message: `Minecraft Offline\n\nTime:\n${formatTimestamp()}\n\nReason:\nPod Not Ready`,
    }, (startedAt) => `Minecraft Recovered\n\nDowntime:\n${formatDuration(startedAt)}`);

    await raise('backup-failed', {
      active: snapshot.backup?.latestJob?.failed === true,
      severity: 'WARN',
      summary: 'Backup failed',
      recoverySummary: 'Backup recovered',
      message: `Backup Failed\n\nTime:\n${formatTimestamp()}\n\nReason:\nBackup Job Failed`,
    }, (startedAt) => `Backup Recovered\n\nIncident Duration:\n${formatDuration(startedAt)}`);

    await raise('backup-stale', {
      active: snapshot.backup?.available === true && snapshot.backup?.stale === true,
      severity: 'WARN',
      summary: 'Backup stale',
      recoverySummary: 'Backup recovered',
      message: `Backup Stale\n\nLast Backup:\n${snapshot.backup?.lastBackupAge ?? 'not available'}`,
    }, (startedAt) => `Backup Fresh Again\n\nIncident Duration:\n${formatDuration(startedAt)}`);
  }

  const timer = setInterval(() => {
    evaluate().catch((error) => logger.error('mineops alert evaluation failed', { error: error.message }));
  }, config.monitoring.intervalMs);
  timer.unref();

  evaluate().catch((error) => logger.error('mineops initial alert evaluation failed', { error: error.message }));
  logger.info('mineops alert loop started', { intervalMs: config.monitoring.intervalMs, alertChannelConfigured: Boolean(alertProvider) });

  return { stop() { clearInterval(timer); } };
}
