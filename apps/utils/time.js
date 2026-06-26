function pad(value) {
  return String(value).padStart(2, '0');
}

export function localTimestamp(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function localCompactTimestamp(date = new Date()) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseTimestamp(value) {
  if (value instanceof Date) return value;
  if (value == null || value === '') return new Date(Number.NaN);
  if (typeof value !== 'string') return new Date(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!match) return new Date(value);
  const [, year, month, day, hour, minute, second] = match.map(Number);
  return new Date(year, month - 1, day, hour, minute, second);
}

export function localMinute(value) {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return localTimestamp(date).slice(0, 16);
}

export function localShortTime(value) {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return '??:??';
  return localTimestamp(date).slice(11, 16);
}

export function localDateTime(value = new Date()) {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return localTimestamp(date);
}
