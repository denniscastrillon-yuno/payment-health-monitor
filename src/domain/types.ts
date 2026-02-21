import { z } from 'zod';

// --- Transaction ---

export const transactionStatusValues = ['approved', 'declined', 'pending', 'timeout', 'error'] as const;
export type TransactionStatus = (typeof transactionStatusValues)[number];

export const transactionSchema = z.object({
  id: z.string().min(1),
  psp: z.string().min(1),
  payment_method: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  status: z.enum(transactionStatusValues),
  response_time_ms: z.number().int().nonnegative(),
  created_at: z.string().datetime({ offset: true }),
});

export type TransactionInput = z.infer<typeof transactionSchema>;

export interface Transaction extends TransactionInput {
  ingested_at: string;
}

// --- Metrics ---

export interface PSPMetrics {
  psp: string;
  total_transactions: number;
  approved_count: number;
  declined_count: number;
  timeout_count: number;
  error_count: number;
  pending_count: number;
  timeout_rate: number;
  error_rate: number;
  success_rate: number;
  avg_response_time_ms: number;
  p95_response_time_ms: number;
  time_window: { from: string; to: string };
}

export interface PaymentMethodMetrics extends PSPMetrics {
  payment_method: string;
}

// --- Health Status ---

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface PSPHealth {
  psp: string;
  status: HealthStatus;
  metrics: PSPMetrics;
  alerts: AlertMessage[];
}

export interface AlertMessage {
  metric: string;
  threshold: string;
  current_value: number;
  severity: 'warning' | 'critical';
}

// --- Alert Summary ---

export interface AlertSummary {
  timestamp: string;
  unhealthy_psps: PSPHealth[];
  degraded_psps: PSPHealth[];
  healthy_psps: PSPHealth[];
  total_psps: number;
}

// --- Trend ---

export interface TrendData {
  psp: string;
  current_window: PSPMetrics;
  baseline_window: PSPMetrics;
  trends: {
    timeout_rate: TrendDirection;
    error_rate: TrendDirection;
    avg_response_time: TrendDirection;
    success_rate: TrendDirection;
  };
}

export interface TrendDirection {
  direction: 'improving' | 'stable' | 'worsening';
  change_percent: number;
}

// --- Health Score ---

export interface PSPHealthScore {
  psp: string;
  score: number;
  status: HealthStatus;
  breakdown: {
    timeout_component: number;
    error_component: number;
    success_component: number;
    response_time_component: number;
  };
}

// --- Aggregated row from SQL ---

export interface AggregatedRow {
  psp: string;
  payment_method?: string;
  total: number;
  approved: number;
  declined: number;
  timeout: number;
  error: number;
  pending: number;
  avg_response_time: number;
}

// --- Time range query ---

export interface TimeRange {
  from: string;
  to: string;
}
