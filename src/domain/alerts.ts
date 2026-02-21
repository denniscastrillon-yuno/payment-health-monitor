import { alertThresholds } from '../config';
import { AlertMessage, HealthStatus, PSPMetrics } from './types';

export function evaluateHealth(metrics: PSPMetrics): { status: HealthStatus; alerts: AlertMessage[] } {
  const alerts: AlertMessage[] = [];

  // Timeout rate check
  if (metrics.timeout_rate > alertThresholds.timeoutRate.unhealthy) {
    alerts.push({
      metric: 'timeout_rate',
      threshold: `> ${alertThresholds.timeoutRate.unhealthy * 100}%`,
      current_value: metrics.timeout_rate,
      severity: 'critical',
    });
  } else if (metrics.timeout_rate > alertThresholds.timeoutRate.degraded) {
    alerts.push({
      metric: 'timeout_rate',
      threshold: `> ${alertThresholds.timeoutRate.degraded * 100}%`,
      current_value: metrics.timeout_rate,
      severity: 'warning',
    });
  }

  // Avg response time check
  if (metrics.avg_response_time_ms > alertThresholds.avgResponseTime.unhealthy) {
    alerts.push({
      metric: 'avg_response_time_ms',
      threshold: `> ${alertThresholds.avgResponseTime.unhealthy}ms`,
      current_value: metrics.avg_response_time_ms,
      severity: 'critical',
    });
  } else if (metrics.avg_response_time_ms > alertThresholds.avgResponseTime.degraded) {
    alerts.push({
      metric: 'avg_response_time_ms',
      threshold: `> ${alertThresholds.avgResponseTime.degraded}ms`,
      current_value: metrics.avg_response_time_ms,
      severity: 'warning',
    });
  }

  // Error rate check
  if (metrics.error_rate > alertThresholds.errorRate.unhealthy) {
    alerts.push({
      metric: 'error_rate',
      threshold: `> ${alertThresholds.errorRate.unhealthy * 100}%`,
      current_value: metrics.error_rate,
      severity: 'critical',
    });
  } else if (metrics.error_rate > alertThresholds.errorRate.degraded) {
    alerts.push({
      metric: 'error_rate',
      threshold: `> ${alertThresholds.errorRate.degraded * 100}%`,
      current_value: metrics.error_rate,
      severity: 'warning',
    });
  }

  const hasCritical = alerts.some(a => a.severity === 'critical');
  const hasWarning = alerts.some(a => a.severity === 'warning');

  let status: HealthStatus = 'healthy';
  if (hasCritical) status = 'unhealthy';
  else if (hasWarning) status = 'degraded';

  return { status, alerts };
}
