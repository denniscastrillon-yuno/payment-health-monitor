import { FastifyInstance } from 'fastify';
import { MetricsService } from '../../services/metrics.service';
import { parseTimeRange } from '../schemas/query.schema';

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  const metricsService = new MetricsService();

  // GET /api/health - All PSPs metrics + health status
  fastify.get('/api/health', async (request, reply) => {
    const query = request.query as { from?: string; to?: string };
    const timeRange = parseTimeRange(query);
    const result = metricsService.getAllPSPMetrics(timeRange);
    return reply.send({ success: true, data: result });
  });

  // GET /api/health/scores - Stretch C: Health scores
  // NOTE: Must be registered before :psp param route
  fastify.get('/api/health/scores', async (request, reply) => {
    const query = request.query as { from?: string; to?: string };
    const timeRange = parseTimeRange(query);
    const scores = metricsService.getHealthScores(timeRange);
    return reply.send({ success: true, data: { scores } });
  });

  // GET /api/health/:psp - Specific PSP metrics + health status
  fastify.get('/api/health/:psp', async (request, reply) => {
    const { psp } = request.params as { psp: string };
    const query = request.query as { from?: string; to?: string };
    const timeRange = parseTimeRange(query);
    const result = metricsService.getPSPMetrics(psp, timeRange);

    if (!result) {
      return reply.status(404).send({
        success: false,
        error: `No data found for PSP: ${psp}`,
      });
    }

    return reply.send({ success: true, data: result });
  });

  // GET /api/health/:psp/methods - Stretch A: Breakdown by payment method
  fastify.get('/api/health/:psp/methods', async (request, reply) => {
    const { psp } = request.params as { psp: string };
    const query = request.query as { from?: string; to?: string };
    const timeRange = parseTimeRange(query);
    const methods = metricsService.getPaymentMethodBreakdown(psp, timeRange);

    if (methods.length === 0) {
      return reply.status(404).send({
        success: false,
        error: `No data found for PSP: ${psp}`,
      });
    }

    return reply.send({ success: true, data: { psp, methods } });
  });

  // GET /api/health/:psp/trends - Stretch B: Trend detection
  fastify.get('/api/health/:psp/trends', async (request, reply) => {
    const { psp } = request.params as { psp: string };
    const query = request.query as { from?: string; to?: string };
    const timeRange = parseTimeRange(query);
    const trends = metricsService.getTrends(psp, timeRange);

    if (!trends) {
      return reply.status(404).send({
        success: false,
        error: `No data found for PSP: ${psp}`,
      });
    }

    return reply.send({ success: true, data: trends });
  });
}
