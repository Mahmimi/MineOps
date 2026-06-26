import { localShortTime, parseTimestamp } from '../../../utils/time.js';

export function formatDurationFromSeconds(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function age(dateValue) {
  if (!dateValue) return 'not available';
  const seconds = Math.max(0, Math.floor((Date.now() - parseTimestamp(dateValue).getTime()) / 1000));
  if (seconds < 60) return 'less than a minute ago';
  return `${formatDurationFromSeconds(seconds)} ago`;
}

export function durationSince(dateValue) {
  if (!dateValue) return 'not available';
  return formatDurationFromSeconds(Math.max(0, Math.floor((Date.now() - parseTimestamp(dateValue).getTime()) / 1000)));
}

export function shortTime(timestamp) {
  return localShortTime(timestamp);
}
