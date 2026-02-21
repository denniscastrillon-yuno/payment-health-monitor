import { AlertSummary, PSPHealth, TimeRange } from '../domain/types';
import { MetricsService } from './metrics.service';

export class AlertService {
  private metricsService: MetricsService;

  constructor() {
    this.metricsService = new MetricsService();
  }

  getAlertSummary(timeRange?: TimeRange, paymentMethod?: string): AlertSummary {
    const result = this.metricsService.getAllPSPMetrics(timeRange, paymentMethod);

    const unhealthy: PSPHealth[] = [];
    const degraded: PSPHealth[] = [];
    const healthy: PSPHealth[] = [];

    for (const psp of result.psps) {
      const health: PSPHealth = {
        psp: psp.metrics.psp,
        status: psp.status as PSPHealth['status'],
        metrics: psp.metrics,
        alerts: psp.alerts as PSPHealth['alerts'],
      };

      switch (psp.status) {
        case 'unhealthy':
          unhealthy.push(health);
          break;
        case 'degraded':
          degraded.push(health);
          break;
        default:
          healthy.push(health);
      }
    }

    return {
      timestamp: new Date().toISOString(),
      unhealthy_psps: unhealthy,
      degraded_psps: degraded,
      healthy_psps: healthy,
      total_psps: result.psps.length,
    };
  }
}
