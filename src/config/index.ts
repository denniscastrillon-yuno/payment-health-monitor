import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  DB_PATH: z.string().default('./data/payments.db'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  TIMEOUT_RATE_UNHEALTHY: z.coerce.number().default(0.15),
  TIMEOUT_RATE_DEGRADED: z.coerce.number().default(0.12),
  AVG_RESPONSE_TIME_UNHEALTHY: z.coerce.number().default(20000),
  AVG_RESPONSE_TIME_DEGRADED: z.coerce.number().default(16000),
  ERROR_RATE_UNHEALTHY: z.coerce.number().default(0.10),
  ERROR_RATE_DEGRADED: z.coerce.number().default(0.08),

  DEFAULT_TIME_WINDOW_MINUTES: z.coerce.number().default(60),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;

export const alertThresholds = {
  timeoutRate: {
    unhealthy: config.TIMEOUT_RATE_UNHEALTHY,
    degraded: config.TIMEOUT_RATE_DEGRADED,
  },
  avgResponseTime: {
    unhealthy: config.AVG_RESPONSE_TIME_UNHEALTHY,
    degraded: config.AVG_RESPONSE_TIME_DEGRADED,
  },
  errorRate: {
    unhealthy: config.ERROR_RATE_UNHEALTHY,
    degraded: config.ERROR_RATE_DEGRADED,
  },
};
