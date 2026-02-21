import { TransactionRepository } from '../infrastructure/repositories/transaction.repository';
import { buildPSPMetrics, calculateP95, calculateHealthScore, calculateTrend, calculateTrendForSuccessRate } from '../domain/metrics';
import { PSPMetrics, TimeRange, PaymentMethodMetrics, TrendData, PSPHealthScore, AggregatedRow } from '../domain/types';
import { evaluateHealth } from '../domain/alerts';
import { config } from '../config';

export class MetricsService {
  private repo: TransactionRepository;

  constructor() {
    this.repo = new TransactionRepository();
  }

  getDefaultTimeRange(): TimeRange {
    const now = new Date();
    const from = new Date(now.getTime() - config.DEFAULT_TIME_WINDOW_MINUTES * 60 * 1000);
    return {
      from: from.toISOString(),
      to: now.toISOString(),
    };
  }

  getAllPSPMetrics(timeRange?: TimeRange): { psps: Array<{ metrics: PSPMetrics; status: string; alerts: unknown[] }> } {
    const range = timeRange ?? this.getDefaultTimeRange();
    const rows = this.repo.getAggregatedByPSP(range);

    const psps = rows.map(row => {
      const responseTimes = this.repo.getResponseTimes(row.psp, range);
      const p95 = calculateP95(responseTimes);
      const metrics = buildPSPMetrics(row, p95, range);
      const { status, alerts } = evaluateHealth(metrics);
      return { metrics, status, alerts };
    });

    return { psps };
  }

  getPSPMetrics(psp: string, timeRange?: TimeRange): { metrics: PSPMetrics; status: string; alerts: unknown[] } | null {
    const range = timeRange ?? this.getDefaultTimeRange();
    const row = this.repo.getAggregatedForPSP(psp, range);

    if (!row) return null;

    const responseTimes = this.repo.getResponseTimes(psp, range);
    const p95 = calculateP95(responseTimes);
    const metrics = buildPSPMetrics(row, p95, range);
    const { status, alerts } = evaluateHealth(metrics);

    return { metrics, status, alerts };
  }

  // Stretch A: Breakdown by payment method
  getPaymentMethodBreakdown(psp: string, timeRange?: TimeRange): PaymentMethodMetrics[] {
    const range = timeRange ?? this.getDefaultTimeRange();
    const rows = this.repo.getAggregatedByPaymentMethod(psp, range);

    return rows.map(row => {
      const responseTimes = this.repo.getResponseTimesForPaymentMethod(psp, row.payment_method!, range);
      const p95 = calculateP95(responseTimes);
      const metrics = buildPSPMetrics(row, p95, range);
      return { ...metrics, payment_method: row.payment_method! };
    });
  }

  // Stretch B: Trend detection
  getTrends(psp: string, timeRange?: TimeRange): TrendData | null {
    const range = timeRange ?? this.getDefaultTimeRange();

    // Current window
    const currentRow = this.repo.getAggregatedForPSP(psp, range);
    if (!currentRow) return null;

    const currentResponseTimes = this.repo.getResponseTimes(psp, range);
    const currentP95 = calculateP95(currentResponseTimes);
    const currentMetrics = buildPSPMetrics(currentRow, currentP95, range);

    // Baseline: 24 hours before the current window
    const fromDate = new Date(range.from);
    const toDate = new Date(range.to);
    const windowMs = toDate.getTime() - fromDate.getTime();

    const baselineRange: TimeRange = {
      from: new Date(fromDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      to: new Date(fromDate.getTime()).toISOString(),
    };

    const baselineRow = this.repo.getAggregatedForPSP(psp, baselineRange);
    const baselineResponseTimes = this.repo.getResponseTimes(psp, baselineRange);
    const baselineP95 = calculateP95(baselineResponseTimes);

    const baselineMetrics = baselineRow
      ? buildPSPMetrics(baselineRow, baselineP95, baselineRange)
      : buildPSPMetrics(
          { psp, total: 0, approved: 0, declined: 0, timeout: 0, error: 0, pending: 0, avg_response_time: 0 },
          0,
          baselineRange,
        );

    return {
      psp,
      current_window: currentMetrics,
      baseline_window: baselineMetrics,
      trends: {
        timeout_rate: calculateTrend(currentMetrics.timeout_rate, baselineMetrics.timeout_rate),
        error_rate: calculateTrend(currentMetrics.error_rate, baselineMetrics.error_rate),
        avg_response_time: calculateTrend(currentMetrics.avg_response_time_ms, baselineMetrics.avg_response_time_ms),
        success_rate: calculateTrendForSuccessRate(currentMetrics.success_rate, baselineMetrics.success_rate),
      },
    };
  }

  // Stretch C: Health scores
  getHealthScores(timeRange?: TimeRange): PSPHealthScore[] {
    const range = timeRange ?? this.getDefaultTimeRange();
    const rows = this.repo.getAggregatedByPSP(range);

    return rows.map(row => {
      const responseTimes = this.repo.getResponseTimes(row.psp, range);
      const p95 = calculateP95(responseTimes);
      const metrics = buildPSPMetrics(row, p95, range);
      const { status } = evaluateHealth(metrics);
      const { score, breakdown } = calculateHealthScore(metrics);

      return { psp: row.psp, score, status, breakdown };
    });
  }
}
