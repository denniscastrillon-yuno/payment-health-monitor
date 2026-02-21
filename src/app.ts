import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config';
import { transactionRoutes } from './api/routes/transactions';
import { healthRoutes } from './api/routes/health';
import { alertRoutes } from './api/routes/alerts';
import { eventRoutes } from './api/routes/events';
import { TransactionRepository } from './infrastructure/repositories/transaction.repository';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
  });

  await app.register(cors, { origin: true });

  // Ping endpoint
  app.get('/ping', async () => {
    const repo = new TransactionRepository();
    const count = repo.getTransactionCount();
    return { status: 'ok', transaction_count: count };
  });

  // Register routes
  await app.register(transactionRoutes);
  await app.register(healthRoutes);
  await app.register(alertRoutes);
  await app.register(eventRoutes);

  // Global error handler
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    app.log.error(error);
    reply.status(error.statusCode ?? 500).send({
      success: false,
      error: error.message ?? 'Internal Server Error',
    });
  });

  return app;
}
