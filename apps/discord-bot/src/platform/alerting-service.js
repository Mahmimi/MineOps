function formatDuration(startedAt) {
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const minutes = Math.floor(seconds / 60);
  if (seconds < 60) return `${seconds}s`;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${minutes}m`;
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

  async function publish(payload) {
    if (!alertProvider) return;
    await alertProvider.publish(payload);
  }

  async function raise(key, alert) {
    if (alert.active) {
      if (active.has(key)) return;
      const startedAt = Date.now();
      active.set(key, { startedAt });
      await publish({
        type: key,
        status: 'ACTIVE',
        severity: alert.severity ?? 'WARN',
        title: alert.title ?? alert.summary,
        summary: alert.summary,
        reason: alert.reason,
        details: alert.details,
        startedAt: new Date(startedAt).toISOString(),
      });
      historyStore?.append({ type: key, severity: alert.severity ?? 'WARN', message: alert.summary, resolved: false });
      stateStore?.appendEvent({ type: 'alert', severity: alert.severity ?? 'WARN', message: alert.summary });
      logger.warn('mineops alert raised', { key });
      return;
    }

    const incident = active.get(key);
    if (!incident) return;
    active.delete(key);
    await publish({
      type: key,
      status: 'RESOLVED',
      severity: 'INFO',
      title: alert.summary ?? key,
      recoveryTitle: alert.recoveryTitle ?? alert.recoverySummary ?? `${key} recovered`,
      summary: alert.recoverySummary ?? `${key} recovered`,
      duration: formatDuration(incident.startedAt),
      startedAt: new Date(incident.startedAt).toISOString(),
      resolvedAt: new Date().toISOString(),
    });
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
      title: 'Minecraft Offline',
      recoverySummary: 'Minecraft recovered',
      recoveryTitle: 'Minecraft Recovered',
      reason: 'Pod Not Ready',
    });

    await raise('backup-failed', {
      active: snapshot.backup?.latestJob?.failed === true,
      severity: 'WARN',
      summary: 'Backup failed',
      title: 'Backup Failed',
      recoverySummary: 'Backup recovered',
      recoveryTitle: 'Backup Recovered',
      reason: 'Backup Job Failed',
    });

    await raise('backup-stale', {
      active: snapshot.backup?.available === true && snapshot.backup?.stale === true,
      severity: 'WARN',
      summary: 'Backup stale',
      title: 'Backup Stale',
      recoverySummary: 'Backup recovered',
      recoveryTitle: 'Backup Fresh Again',
      reason: 'Backup age exceeded threshold',
      details: {
        'Last Backup': snapshot.backup?.lastBackupAge ?? 'not available',
      },
    });
  }

  const timer = setInterval(() => {
    evaluate().catch((error) => logger.error('mineops alert evaluation failed', { error: error.message }));
  }, config.monitoring.intervalMs);
  timer.unref();

  evaluate().catch((error) => logger.error('mineops initial alert evaluation failed', { error: error.message }));
  logger.info('mineops alert loop started', { intervalMs: config.monitoring.intervalMs, alertChannelConfigured: Boolean(alertProvider) });

  return { stop() { clearInterval(timer); } };
}
