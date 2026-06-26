import { localTimestamp } from '../../utils/time.js';

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger({ serviceName, level = 'info' }) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  function write(severity, message, fields = {}) {
    if ((LEVELS[severity] ?? LEVELS.info) < threshold) return;

    const entry = {
      timestamp: localTimestamp(),
      severity,
      service: serviceName,
      message,
      ...fields,
    };

    const line = JSON.stringify(entry);
    if (severity === 'error') {
      console.error(line);
      return;
    }

    console.log(line);
  }

  return {
    debug: (message, fields) => write('debug', message, fields),
    info: (message, fields) => write('info', message, fields),
    warn: (message, fields) => write('warn', message, fields),
    error: (message, fields) => write('error', message, fields),
  };
}
