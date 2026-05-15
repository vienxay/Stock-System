import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
  NODE_ENV:                          z.enum(['development', 'production', 'test']).default('development'),
  PORT:                              z.string().default('3000').transform(Number),
  DATABASE_URL:                      z.string().min(1),
  JWT_SECRET:                        z.string().min(32),
  JWT_EXPIRES_IN:                    z.string().default('8h'),
  JWT_REFRESH_SECRET:                z.string().min(32),
  JWT_REFRESH_EXPIRES_IN:            z.string().default('7d'),
  ALLOWED_ORIGINS:                   z.string().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS:              z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX:                    z.string().default('500').transform(Number),
  AUTH_RATE_LIMIT_MAX:               z.string().default('20').transform(Number),
  INVOICE_MATCH_TOLERANCE_PERCENT:   z.string().default('5').transform(Number),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env  = typeof env;
