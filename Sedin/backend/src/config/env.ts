import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root / Sedin workspace directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(9000),

  // Database (MySQL)
  MYSQL_HOST: z.string().default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().default(3306),
  MYSQL_DATABASE: z.string().default('reachinbox'),
  MYSQL_USER: z.string().default('reachinbox_user'),
  MYSQL_PASSWORD: z.string().default('reachinbox_password'),
  DATABASE_URL: z.string(),

  // Redis
  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().default('redispassword'),

  // Elasticsearch
  ELASTICSEARCH_URL: z.string().default('http://127.0.0.1:9200'),
  ELASTICSEARCH_USERNAME: z.string().optional().default(''),
  ELASTICSEARCH_PASSWORD: z.string().optional().default(''),

  // Google OAuth
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  GOOGLE_CALLBACK_URL: z.string(),

  // Slack OAuth
  SLACK_CLIENT_ID: z.string(),
  SLACK_CLIENT_SECRET: z.string(),
  SLACK_REDIRECT_URI: z.string(),

  // Session & Security
  SESSION_SECRET: z.string(),
  ENCRYPTION_KEY: z.string().length(32, 'Encryption key must be exactly 32 hex characters / bytes (or string of length 32)'),
  ADMIN_EMAIL: z.string().email(),

  // SMTP Ethereal
  ETHEREAL_HOST: z.string().default('smtp.ethereal.email'),
  ETHEREAL_PORT: z.coerce.number().default(587),
  ETHEREAL_USER: z.string().optional().default(''),
  ETHEREAL_PASSWORD: z.string().optional().default(''),

  // Worker Configuration
  WORKER_CONCURRENCY: z.coerce.number().default(10),
  MIN_EMAIL_DELAY_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().default(200),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
