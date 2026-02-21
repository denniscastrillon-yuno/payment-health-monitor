import { FastifyInstance } from 'fastify';
import { IngestionService } from '../../services/ingestion.service';
import { ZodError } from 'zod';

export async function transactionRoutes(fastify: FastifyInstance): Promise<void> {
  const ingestionService = new IngestionService();

  // POST /api/transactions - Ingest single transaction
  fastify.post('/api/transactions', async (request, reply) => {
    try {
      const result = ingestionService.ingestSingle(request.body);
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: err.errors,
        });
      }
      // Duplicate key
      if ((err as Error).message?.includes('UNIQUE constraint')) {
        return reply.status(409).send({
          success: false,
          error: 'Transaction with this ID already exists',
        });
      }
      throw err;
    }
  });

  // POST /api/transactions/bulk - Batch ingest
  fastify.post('/api/transactions/bulk', async (request, reply) => {
    try {
      const result = ingestionService.ingestBatch(request.body);
      return reply.status(201).send({
        success: true,
        data: result,
      });
    } catch (err) {
      if (err instanceof ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: err.errors,
        });
      }
      throw err;
    }
  });
}
