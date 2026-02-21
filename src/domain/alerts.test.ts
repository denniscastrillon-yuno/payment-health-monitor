import { describe, it, expect } from 'vitest';
import { evaluateHealth } from './alerts';
import { PSPMetrics } from './types';

function makeMetrics(overrides: Partial<PSPMetrics> = {}): PSPMetrics {
  return {
    psp: 'TestPSP',
    total_transactions: 100,
    approved_count: 95,
    declined_count: 3,
    timeout_count: 1,
    error_count: 1,
    pending_count: 0,
    timeout_rate: 0.01,
    error_rate: 0.01,
    success_rate: 0.9694,
    avg_response_time_ms: 1500,
    p95_response_time_ms: 3000,
    time_window: { from: '2025-01-15T00:00:00.000Z', to: '2025-01-15T01:00:00.000Z' },
    ...overrides,
  };
}

describe('evaluateHealth', () => {
  it('returns healthy with no alerts when all metrics are within thresholds', () => {
    const result = evaluateHealth(makeMetrics());

    expect(result.status).toBe('healthy');
    expect(result.alerts).toHaveLength(0);
  });

  it('returns degraded with warning when timeout rate is in degraded range', () => {
    // degraded threshold: > 12%, unhealthy: > 15%
    const result = evaluateHealth(makeMetrics({ timeout_rate: 0.13 }));

    expect(result.status).toBe('degraded');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].metric).toBe('timeout_rate');
    expect(result.alerts[0].severity).toBe('warning');
  });

  it('returns unhealthy with critical alert when timeout rate exceeds unhealthy threshold', () => {
    const result = evaluateHealth(makeMetrics({ timeout_rate: 0.20 }));

    expect(result.status).toBe('unhealthy');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].metric).toBe('timeout_rate');
    expect(result.alerts[0].severity).toBe('critical');
  });

  it('returns degraded when avg response time is in degraded range', () => {
    // degraded: > 16000ms, unhealthy: > 20000ms
    const result = evaluateHealth(makeMetrics({ avg_response_time_ms: 18000 }));

    expect(result.status).toBe('degraded');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].metric).toBe('avg_response_time_ms');
    expect(result.alerts[0].severity).toBe('warning');
  });

  it('returns unhealthy when avg response time exceeds unhealthy threshold', () => {
    const result = evaluateHealth(makeMetrics({ avg_response_time_ms: 25000 }));

    expect(result.status).toBe('unhealthy');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].metric).toBe('avg_response_time_ms');
    expect(result.alerts[0].severity).toBe('critical');
  });

  it('returns degraded when error rate is in degraded range', () => {
    // degraded: > 8%, unhealthy: > 10%
    const result = evaluateHealth(makeMetrics({ error_rate: 0.09 }));

    expect(result.status).toBe('degraded');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].metric).toBe('error_rate');
    expect(result.alerts[0].severity).toBe('warning');
  });

  it('generates multiple alerts when multiple metrics are breached', () => {
    const result = evaluateHealth(
      makeMetrics({
        timeout_rate: 0.20,
        error_rate: 0.12,
        avg_response_time_ms: 25000,
      }),
    );

    expect(result.status).toBe('unhealthy');
    expect(result.alerts).toHaveLength(3);

    const metrics = result.alerts.map(a => a.metric);
    expect(metrics).toContain('timeout_rate');
    expect(metrics).toContain('error_rate');
    expect(metrics).toContain('avg_response_time_ms');
  });

  it('worst severity wins: critical overrides warning', () => {
    // timeout_rate critical, error_rate warning
    const result = evaluateHealth(
      makeMetrics({
        timeout_rate: 0.20,
        error_rate: 0.09,
      }),
    );

    expect(result.status).toBe('unhealthy');
    expect(result.alerts).toHaveLength(2);
  });

  it('returns healthy when exactly at threshold boundary (strict >)', () => {
    // Exactly at 15% timeout_rate should be healthy (not >)
    const result = evaluateHealth(makeMetrics({ timeout_rate: 0.15 }));

    // 0.15 is NOT > 0.15, so no critical alert
    // 0.15 IS > 0.12, so it triggers degraded warning
    expect(result.status).toBe('degraded');
  });

  it('returns healthy when exactly at degraded boundary', () => {
    // Exactly at 12% — not > 12%, so healthy
    const result = evaluateHealth(makeMetrics({ timeout_rate: 0.12 }));

    expect(result.status).toBe('healthy');
    expect(result.alerts).toHaveLength(0);
  });
});
