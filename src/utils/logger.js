/**
 * Minimal structured logger. Swap for pino/winston in a larger service —
 * kept dependency-free here so the "covert infrastructure" stays lightweight.
 */
const level = process.env.LOG_LEVEL || 'info';

const levels = { error: 0, warn: 1, info: 2, debug: 3 };

function log(lvl, message, meta = {}) {
  if (levels[lvl] > levels[level]) return;
  const entry = {
    timestamp: new Date().toISOString(),
    level: lvl,
    message,
    ...meta,
  };
  // eslint-disable-next-line no-console
  console[lvl === 'debug' ? 'log' : lvl](JSON.stringify(entry));
}

module.exports = {
  error: (message, meta) => log('error', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  info: (message, meta) => log('info', message, meta),
  debug: (message, meta) => log('debug', message, meta),
};
