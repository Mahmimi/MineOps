import fs from 'node:fs';
import path from 'node:path';
import { UserInputError } from '../domain/errors.js';

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

export class EnvProvider {
  constructor({ root }) {
    this.root = root;
  }

  resolve(...parts) {
    return path.join(this.root, ...parts);
  }

  load({ optional = false } = {}) {
    const envPath = this.resolve('.env');
    if (!fs.existsSync(envPath)) {
      if (optional) return this.withDefaults({});
      throw new UserInputError('.env was not found', {
        usage: 'Copy .env.example to .env and fill required values.',
        examples: ['Copy-Item .env.example .env'],
      });
    }

    const values = {};
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const index = trimmed.indexOf('=');
      if (index < 1) continue;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values[key] = value;
    }

    return this.withDefaults(values);
  }

  withDefaults(values) {
    values.MINEOPS_STORAGE_PATH ||= '.local/k3d/storage';
    values.MINEOPS_BACKUP_HOST_PATH ||= './backups';
    values.MINEOPS_TIME_ZONE ||= Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    values.MINEOPS_TIME_OFFSET_SECONDS ||= String(timeZoneOffsetSeconds(values.MINEOPS_TIME_ZONE));
    values.TF_VAR_mineops_time_zone ||= values.MINEOPS_TIME_ZONE;
    values.TF_VAR_mineops_time_offset_seconds ||= values.MINEOPS_TIME_OFFSET_SECONDS;
    if (values.PLAYIT_SECRET_KEY && !values.TF_VAR_playit_secret_value) {
      values.TF_VAR_playit_secret_value = values.PLAYIT_SECRET_KEY;
    }
    if (values.PLAYIT_SECRET_KEY && !values.TF_VAR_playit_replicas) {
      values.TF_VAR_playit_replicas = '1';
    }
    for (const key of ['MINEOPS_STORAGE_PATH', 'MINEOPS_BACKUP_HOST_PATH']) {
      if (values[key] && !path.isAbsolute(values[key])) values[key] = this.resolve(values[key]);
    }
    return values;
  }
}
