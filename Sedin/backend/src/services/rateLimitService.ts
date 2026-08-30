import { redisConnection } from '../config/redis';

// Define custom command for rate limit checking in Redis
// This Lua script runs atomically on the Redis server
const CHECK_AND_RESERVE_SCRIPT = `
local countKey = KEYS[1]
local nextKey = KEYS[2]

local hourLimit = tonumber(ARGV[1])
local minDelayMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- 1. Check minimum delay spacing FIRST. A call that can't send right now
--    is not a real contender for this hour's quota, so it must not touch
--    the hourly counter at all -- that was the second half of the bug:
--    every delay-rejected call was permanently burning one unit of hourly
--    quota it never actually used, so a handful of concurrent/retried
--    attempts could exhaust hourLimit before hourLimit real emails ever sent.
local nextAllowed = redis.call('GET', nextKey)
nextAllowed = nextAllowed and tonumber(nextAllowed) or now

local sendAt = math.max(now, nextAllowed)

if sendAt > now then
    return {0, sendAt, 0} -- Return [0, sendAt, isHourlyCap=0]
end

-- 2. Only a call that could genuinely send right now consumes hourly quota.
local count = redis.call('INCR', countKey)
if count == 1 then
    redis.call('EXPIRE', countKey, 3600)
end

if count > hourLimit then
    redis.call('DECR', countKey) -- give the quota unit back; this attempt never sent
    local hourBucket = math.floor(now / 3600000)
    local nextWindowStart = (hourBucket + 1) * 3600000
    return {0, nextWindowStart, 1} -- Return [0, nextWindowStart, isHourlyCap=1]
end

-- 3. Genuinely granted both checks: reserve the next slot
redis.call('SET', nextKey, sendAt + minDelayMs)

return {1, 0, 0} -- Return [1, 0, 0] (Allowed to send immediately)
`;

// Register the Lua script command with ioredis
// The command name will be 'checkAndReserve'
redisConnection.defineCommand('checkAndReserve', {
  numberOfKeys: 2,
  lua: CHECK_AND_RESERVE_SCRIPT,
});

export interface RateLimitResult {
  allowed: boolean;
  retryAt: number;
  isHourlyCap: boolean;
}

export class RateLimitService {
  /**
   * Atomically checks and reserves a send slot for a sender.
   */
  static async checkAndReserve(
    senderId: string,
    hourLimit: number,
    minDelayMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const hourBucket = Math.floor(now / 3600000);
    const countKey = `rl:count:${senderId}:${hourBucket}`;
    const nextKey = `rl:next:${senderId}`;

    // Call our custom Lua script registered command
    // Typescript doesn't know about defineCommand dynamically on the interface, 
    // so we cast to any or call it using brackets
    const result: [number, number, number] = await (redisConnection as any).checkAndReserve(
      countKey,
      nextKey,
      hourLimit,
      minDelayMs,
      now
    );

    return {
      allowed: result[0] === 1,
      retryAt: result[1],
      isHourlyCap: result[2] === 1,
    };
  }

  static async getSecondsRemainingInHour(): Promise<number> {
    const now = Date.now();
    const hourBucket = Math.floor(now / 3600000);
    const nextHourStart = (hourBucket + 1) * 3600000;
    return Math.max(0, Math.ceil((nextHourStart - now) / 1000));
  }
}
