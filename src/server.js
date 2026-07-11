require('dotenv').config();
const app = require('./app');
const logger = require('./utils/logger');
const prisma = require('./utils/prisma');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Identity Reconciliation service listening on port ${PORT}`);
});

// --- Graceful shutdown -------------------------------------------------
async function shutdown(signal) {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Server closed, DB disconnected. Bye.');
    process.exit(0);
  });

  // Force-exit if something hangs.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
});
