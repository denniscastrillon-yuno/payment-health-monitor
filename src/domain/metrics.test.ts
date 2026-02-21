import { describe, it, expect } from 'vitest';
import { calculateP95, buildPSPMetrics, calculateHealthScore, calculateTrend, calculateTrendForSuccessRate } from './metrics';
import { AggregatedRow, TimeRange } from './types';

const TIME_RANGE: TimeRange = {
  from: '2025-01-15T00:00:00.000Z',
  to: '2025-01-15T01:00:00.000Z',
};

describe('calculateP95', () => {
  it('returns 0 for empty array', () => {
    expect(calculateP95([])).toBe(0);
  });

  it('returns the single element for a one-element array', () => {
    expect(calculateP95([500])).toBe(500);
  });

  it('returns correct P95 for a known sorted array', () => {
    // 20 elements sorted: indices 0-19
    // P95 index = floor(0.95 * 20) = 19
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    expect(calculateP95(values)).toBe(2000);
  });

  it('returns correct P95 for 100 elements', () => {
    // 100 elements: indices 0-99
    // P95 index = floor(0.95 * 100) = 95
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(calculateP95(values)).toBe(96);
  });
});

describe('buildPSPMetrics', () => {
  it('calculates rates correctly', () => {
    const row: AggregatedRow = {
      psp: 'TestPSP',
      total: 100,
      approved: 80,
      declined: 5,
      timeout: 10,
      error: 3,
      pending: 2,
      avg_response_time: 1500.5,
    };

    const metrics = buildPSPMetrics(row, 3000, TIME_RANGE);

    expect(metrics.psp).toBe('TestPSP');
    expect(metrics.total_transactions).toBe(100);
    expect(metrics.timeout_rate).toBe(0.1); // 10/100
    expect(metrics.error_rate).toBe(0.03); // 3/100
    // success_rate = 80 / (100 - 10 - 3) = 80/87
    expect(metrics.success_rate).toBeCloseTo(0.9195, 3);
    expect(metrics.avg_response_time_ms).toBe(1500.5);
    expect(metrics.p95_response_time_ms).toBe(3000);
    expect(metrics.time_window).toEqual(TIME_RANGE);
  });

  it('handles zero total gracefully', () => {
    const row: AggregatedRow = {
      psp: 'EmptyPSP',
      total: 0,
      approved: 0,
      declined: 0,
      timeout: 0,
      error: 0,
      pending: 0,
      avg_response_time: 0,
    };

    const metrics = buildPSPMetrics(row, 0, TIME_RANGE);

    expect(metrics.timeout_rate).toBe(0);
    expect(metrics.error_rate).toBe(0);
    expect(metrics.success_rate).toBe(0);
  });
});

describe('calculateHealthScore', () => {
  it('returns ~100 for a perfectly healthy PSP', () => {
    const metrics = buildPSPMetrics(
      { psp: 'Healthy', total: 100, approved: 100, declined: 0, timeout: 0, error: 0, pending: 0, avg_response_time: 1000 },
      1500,
      TIME_RANGE,
    );

    const { score, breakdown } = calculateHealthScore(metrics);

    // (1-0)*30 + (1-0)*30 + 1*20 + max(0,1-1000/30000)*20 = 30+30+20+19.33 ≈ 99.3
    expect(score).toBeGreaterThan(99);
    expect(score).toBeLessThanOrEqual(100);
    expect(breakdown.timeout_component).toBe(30);
    expect(breakdown.error_component).toBe(30);
    expect(breakdown.success_component).toBe(20);
  });

  it('returns a low score for an unhealthy PSP', () => {
    const metrics = buildPSPMetrics(
      { psp: 'Bad', total: 100, approved: 20, declined: 10, timeout: 50, error: 15, pending: 5, avg_response_time: 25000 },
      30000,
      TIME_RANGE,
    );

    const { score } = calculateHealthScore(metrics);

    expect(score).toBeLessThan(60);
  });

  it('clamps score to [0, 100]', () => {
    // Very high response time could push response_time_component negative,
    // but max(0, ...) prevents it; test total clamping
    const metrics = buildPSPMetrics(
      { psp: 'Awful', total: 100, approved: 0, declined: 0, timeout: 100, error: 0, pending: 0, avg_response_time: 50000 },
      60000,
      TIME_RANGE,
    );

    const { score } = calculateHealthScore(metrics);

    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('calculateTrend', () => {
  it('returns stable when both are zero', () => {
    const result = calculateTrend(0, 0);
    expect(result.direction).toBe('stable');
    expect(result.change_percent).toBe(0);
  });

  it('returns worsening when baseline is zero but current is not', () => {
    const result = calculateTrend(0.1, 0);
    expect(result.direction).toBe('worsening');
    expect(result.change_percent).toBe(100);
  });

  it('returns stable when change is within 5%', () => {
    const result = calculateTrend(1.02, 1.0);
    expect(result.direction).toBe('stable');
  });

  it('returns worsening when timeout rate increases significantly', () => {
    const result = calculateTrend(0.20, 0.10);
    expect(result.direction).toBe('worsening');
    expect(result.change_percent).toBe(100);
  });

  it('returns improving when timeout rate decreases significantly', () => {
    const result = calculateTrend(0.05, 0.10);
    expect(result.direction).toBe('improving');
    expect(result.change_percent).toBe(-50);
  });
});

describe('calculateTrendForSuccessRate', () => {
  it('returns stable when both are zero', () => {
    const result = calculateTrendForSuccessRate(0, 0);
    expect(result.direction).toBe('stable');
  });

  it('returns improving when baseline is zero but current is not', () => {
    const result = calculateTrendForSuccessRate(0.95, 0);
    expect(result.direction).toBe('improving');
  });

  it('returns improving when success rate increases', () => {
    const result = calculateTrendForSuccessRate(0.95, 0.80);
    expect(result.direction).toBe('improving');
  });

  it('returns worsening when success rate decreases', () => {
    const result = calculateTrendForSuccessRate(0.70, 0.90);
    expect(result.direction).toBe('worsening');
  });

  it('returns stable when change is within 5%', () => {
    const result = calculateTrendForSuccessRate(0.91, 0.90);
    expect(result.direction).toBe('stable');
  });
});
