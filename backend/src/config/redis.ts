import Redis, { RedisOptions } from 'ioredis';
import { env } from './env';

export const redisConfig: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
};

export const createRedisClient = () => {
  return new Redis(redisConfig);
};

// Singleton instance for general app caching / rate-limiting operations
export const redisConnection = createRedisClient();
