import http from 'http';

import { createApp, setReadiness } from './app';
import { checkDatabaseConnection, runMigrations } from '../config/database';
import apiKeyService from '../services/apiKeyService';
import { startReceiptCheckJob, startScheduledProcessor } from '../services/pushService';
import { startPaymentIdempotencyCleanupJob } from '../services/stellarPaymentService';
import { createSignalingServer } from '../services/webrtcService';
import logger from '../utils/logger';

const PORT = Number(process.env.PORT) || 3000;

let isShuttingDown = false;

function shutdown(signal: NodeJS.Signals, server: http.Server): void {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.warn(`Received ${signal} — starting graceful shutdown`);
  setReadiness(false);

  server.close((err) => {
    if (err) {
      logger.error('Error while closing server', { error: err.message });
      process.exit(1);
    }
    logger.info('All connections drained — exiting cleanly');
    process.exit(0);
  });

  const shutdownTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 9_000) as unknown as NodeJS.Timeout;
  shutdownTimer.unref();
}

async function start(): Promise<void> {
  await checkDatabaseConnection();
  logger.info('[server] Database connection verified.');

  await runMigrations();

  const app = createApp();
  const server = http.createServer(app);
  createSignalingServer(server);

  process.on('SIGTERM', () => shutdown('SIGTERM', server));
  process.on('SIGINT', () => shutdown('SIGINT', server));

  server.listen(PORT, () => {
    logger.info(`Cocohub REST API listening on http://localhost:${PORT}/api`);
    logger.info(`Health:  http://localhost:${PORT}/api/health`);
    logger.info(`Ready:   http://localhost:${PORT}/api/ready`);
    logger.info(`Admin:   http://localhost:${PORT}/admin/api-keys.html`);

    const rotationInterval = setInterval(
      () => apiKeyService.processRotationExpiry(),
      60_000,
    ) as unknown as NodeJS.Timeout;
    rotationInterval.unref();

    const idempotencyCleanupInterval = startPaymentIdempotencyCleanupJob();
    idempotencyCleanupInterval.unref();

    const receiptCheckInterval = startReceiptCheckJob();
    receiptCheckInterval.unref();

    const scheduledProcessor = startScheduledProcessor();
    scheduledProcessor.unref();

    if (process.send) process.send('ready');
  });
}

start().catch((err) => {
  logger.error('[server] Startup failed:', err);
  process.exit(1);
});
