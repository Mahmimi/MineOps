import path from 'node:path';

function timeZoneOffsetSeconds(timeZone, date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date).reduce((values, part) => {
    if (part.type !== 'literal') values[part.type] = Number(part.value);
    return values;
  }, {});
  const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const utcInstant = Math.floor(date.getTime() / 1000) * 1000;
  return Math.round((localAsUtc - utcInstant) / 1000);
}

export function withLegacyEnvDefaults(values, { root }) {
  const resolved = { ...values };
  resolved.MINEOPS_STORAGE_PATH ||= '.local/k3d/storage';
  resolved.MINEOPS_BACKUP_HOST_PATH ||= './backups';
  resolved.MINEOPS_TIME_ZONE ||= Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  resolved.MINEOPS_TIME_OFFSET_SECONDS ||= String(timeZoneOffsetSeconds(resolved.MINEOPS_TIME_ZONE));
  resolved.TF_VAR_mineops_time_zone ||= resolved.MINEOPS_TIME_ZONE;
  resolved.TF_VAR_mineops_time_offset_seconds ||= resolved.MINEOPS_TIME_OFFSET_SECONDS;
  if (resolved.PLAYIT_SECRET_KEY && !resolved.TF_VAR_playit_secret_value) {
    resolved.TF_VAR_playit_secret_value = resolved.PLAYIT_SECRET_KEY;
  }
  if (resolved.PLAYIT_SECRET_KEY && !resolved.TF_VAR_playit_replicas) {
    resolved.TF_VAR_playit_replicas = '1';
  }
  for (const key of ['MINEOPS_STORAGE_PATH', 'MINEOPS_BACKUP_HOST_PATH']) {
    if (resolved[key] && !path.isAbsolute(resolved[key])) resolved[key] = path.join(root, resolved[key]);
  }
  return resolved;
}

