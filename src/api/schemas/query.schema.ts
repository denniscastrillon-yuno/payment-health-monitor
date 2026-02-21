import { z } from 'zod';
import { TimeRange } from '../../domain/types';
import { config } from '../../config';

export const timeRangeQuery = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  payment_method: z.string().optional(),
});

export interface QueryFilter {
  timeRange: TimeRange;
  paymentMethod?: string;
}

export function parseTimeRange(query: { from?: string; to?: string }): TimeRange {
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - config.DEFAULT_TIME_WINDOW_MINUTES * 60 * 1000);

  return {
    from: query.from ?? defaultFrom.toISOString(),
    to: query.to ?? now.toISOString(),
  };
}

export function parseQueryFilter(query: { from?: string; to?: string; payment_method?: string }): QueryFilter {
  return {
    timeRange: parseTimeRange(query),
    paymentMethod: query.payment_method,
  };
}
