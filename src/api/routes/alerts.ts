import { FastifyInstance } from 'fastify';
import { AlertService } from '../../services/alert.service';
import { alertThresholds } from '../../config';
import { parseTimeRange } from '../schemas/query.schema';

export async function alertRoutes(fastify: FastifyInstance): Promise<void> {
  const alertService = new AlertService();

  // GET /api/alerts - Current alert summary
  fastify.get('/api/alerts', async (request, reply) => {
    const query = request.query as { from?: string; to?: string };
    const timeRange = parseTimeRange(query);
    const summary = alertService.getAlertSummary(timeRange);
    return reply.send({ success: true, data: summary });
  });

  // GET /api/alerts/config - View threshold configuration
  fastify.get('/api/alerts/config', async (_request, reply) => {
    return reply.send({
      success: true,
      data: {
        thresholds: {
          timeout_rate: {
            unhealthy: `> ${alertThresholds.timeoutRate.unhealthy * 100}%`,
            degraded: `> ${alertThresholds.timeoutRate.degraded * 100}%`,
          },
          avg_response_time_ms: {
            unhealthy: `> ${alertThresholds.avgResponseTime.unhealthy}ms`,
            degraded: `> ${alertThresholds.avgResponseTime.degraded}ms`,
          },
          error_rate: {
            unhealthy: `> ${alertThresholds.errorRate.unhealthy * 100}%`,
            degraded: `> ${alertThresholds.errorRate.degraded * 100}%`,
          },
        },
      },
    });
  });
}
