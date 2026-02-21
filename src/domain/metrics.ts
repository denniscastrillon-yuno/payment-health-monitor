import { AggregatedRow, PSPMetrics, TimeRange, TrendDirection } from './types';

export function calculateP95(sortedValues: number[]): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.floor(0.95 * sortedValues.length);
  return sortedValues[Math.min(index, sortedValues.length - 1)];
}

export function buildPSPMetrics(row: AggregatedRow, p95: number, timeRange: TimeRange): PSPMetrics {
  const total = row.total;
  const completedTransactions = total - row.timeout - row.error;

  return {
    psp: row.psp,
    total_transactions: total,
    approved_count: row.approved,
    declined_count: row.declined,
    timeout_count: row.timeout,
    error_count: row.error,
    pending_count: row.pending,
    timeout_rate: total > 0 ? round(row.timeout / total, 4) : 0,
    error_rate: total > 0 ? round(row.error / total, 4) : 0,
    success_rate: completedTransactions > 0 ? round(row.approved / completedTransactions, 4) : 0,
    avg_response_time_ms: round(row.avg_response_time, 2),
    p95_response_time_ms: p95,
    time_window: { from: timeRange.from, to: timeRange.to },
  };
}

export function calculateHealthScore(metrics: PSPMetrics): {
  score: number;
  breakdown: {
    timeout_component: number;
    error_component: number;
    success_component: number;
    response_time_component: number;
  };
} {
  const timeoutComponent = (1 - metrics.timeout_rate) * 30;
  const errorComponent = (1 - metrics.error_rate) * 30;
  const successComponent = metrics.success_rate * 20;
  const responseTimeFactor = Math.max(0, 1 - metrics.avg_response_time_ms / 30000);
  const responseTimeComponent = responseTimeFactor * 20;

  const score = round(timeoutComponent + errorComponent + successComponent + responseTimeComponent, 1);

  return {
    score: Math.max(0, Math.min(100, score)),
    breakdown: {
      timeout_component: round(timeoutComponent, 2),
      error_component: round(errorComponent, 2),
      success_component: round(successComponent, 2),
      response_time_component: round(responseTimeComponent, 2),
    },
  };
}

export function calculateTrend(current: number, baseline: number): TrendDirection {
  if (baseline === 0 && current === 0) {
    return { direction: 'stable', change_percent: 0 };
  }
  if (baseline === 0) {
    return { direction: 'worsening', change_percent: 100 };
  }

  const changePercent = round(((current - baseline) / baseline) * 100, 2);
  const absChange = Math.abs(changePercent);

  if (absChange < 5) {
    return { direction: 'stable', change_percent: changePercent };
  }

  return {
    direction: changePercent > 0 ? 'worsening' : 'improving',
    change_percent: changePercent,
  };
}

export function calculateTrendForSuccessRate(current: number, baseline: number): TrendDirection {
  if (baseline === 0 && current === 0) {
    return { direction: 'stable', change_percent: 0 };
  }
  if (baseline === 0) {
    return { direction: 'improving', change_percent: 100 };
  }

  const changePercent = round(((current - baseline) / baseline) * 100, 2);
  const absChange = Math.abs(changePercent);

  if (absChange < 5) {
    return { direction: 'stable', change_percent: changePercent };
  }

  // For success rate, positive change = improving
  return {
    direction: changePercent > 0 ? 'improving' : 'worsening',
    change_percent: changePercent,
  };
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
