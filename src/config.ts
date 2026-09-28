import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:8080')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  BODY_LIMIT: z.string().default('100kb'),
  WEATHER_API_URL: z.url().default('https://api.open-meteo.com/v1/forecast'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(5_000),
  WEATHER_FORECAST_DAYS: z.coerce.number().int().min(1).max(16).default(5),
  WEATHER_MAX_WIND_KMPH: z.coerce.number().nonnegative().default(15),
  WEATHER_ALLOWED_PRECIPITATION_MM: z.coerce.number().nonnegative().default(0),
  DB_HOST: z.string().min(1).default('localhost'),
  DB_PORT: z.coerce.number().int().min(1).max(65_535).default(5432),
  DB_NAME: z.string().min(1).default('appdb'),
  DB_USER: z.string().min(1).default('app_rw'),
  DB_PASSWORD: z.string().default(''),
  DB_POOL_MAX: z.coerce.number().int().positive().max(100).default(10),
  DB_POOL_IDLE_MS: z.coerce.number().int().positive().default(30_000),
  DB_POOL_ACQUIRE_MS: z.coerce.number().int().positive().default(5_000),
  DB_LOG_QUERIES: z.stringbool().default(false),
  DB_CONNECT_RETRIES: z.coerce.number().int().positive().max(100).default(10),
  DB_RETRY_BASE_DELAY_MS: z.coerce.number().int().positive().max(10_000).default(500),
  DB_MIGRATION_USER: z.string().min(1).default('postgres'),
  DB_MIGRATION_PASSWORD: z.string().default(''),
  DEFAULT_AUTHOR: z.string().min(1).default('system'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${z.prettifyError(parsed.error)}`);
}

export const config = parsed.data;