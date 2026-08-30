/**
 * Loads the ACTUAL Lua script from rateLimitService.ts (copy-pasted, not
 * reimplemented) against a real local Redis and confirms:
 *   1. Min-delay rejections report isHourlyCap = 0
 *   2. Hourly-cap rejections report isHourlyCap = 1
 * This is the exact signal emailWorker.ts uses to decide whether to call
 * SlackNotificationService.notifyHourlyCapExceeded.
 */
const Redis = require('ioredis');
const port = process.env.REDIS_PORT || 6399;
const redis = new Redis({ port });

const CHECK_AND_RESERVE_SCRIPT = `
local countKey = KEYS[1]
local nextKey = KEYS[2]

local hourLimit = tonumber(ARGV[1])
local minDelayMs = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- 1. Increment hourly window counter
local count = redis.call('INCR', countKey)
if count == 1 then
    redis.call('EXPIRE', countKey, 3600)
end

-- 2. Check if hourly limit exceeded
if count > hourLimit then
    redis.call('DECR', countKey)
    local hourBucket = math.floor(now / 3600000)
    local nextWindowStart = (hourBucket + 1) * 3600000
    return {0, nextWindowStart, 1}
end

-- 3. Check minimum delay spacing
local nextAllowed = redis.call('GET', nextKey)
nextAllowed = nextAllowed and tonumber(nextAllowed) or now

local sendAt = math.max(now, nextAllowed)

-- 4. Reserve next slot
redis.call('SET', nextKey, sendAt + minDelayMs)

-- 5. If delay not elapsed, reschedule
if sendAt > now then
    return {0, sendAt, 0}
end

return {1, 0, 0}
`;

redis.defineCommand('checkAndReserve', { numberOfKeys: 2, lua: CHECK_AND_RESERVE_SCRIPT });

async function main() {
  const senderId = 'lua-test-sender';
  const hourBucket = Math.floor(Date.now() / 3600000);
  const countKey = `rl:count:${senderId}:${hourBucket}`;
  const nextKey = `rl:next:${senderId}`;
  await redis.del(countKey, nextKey);

  // Case A: min-delay rejection. hourLimit huge, minDelayMs huge, so 2nd call in same ms rejects on delay, not cap.
  const now = Date.now();
  const first = await redis.checkAndReserve(countKey, nextKey, 1000, 60000, now);
  const second = await redis.checkAndReserve(countKey, nextKey, 1000, 60000, now);
  console.log('Min-delay case — first call:', first, '(expect allowed=1)');
  console.log('Min-delay case — second call:', second, '(expect allowed=0, isHourlyCap=0)');
  if (Number(second[0]) !== 0 || Number(second[2]) !== 0) {
    console.error('FAIL: expected min-delay rejection with isHourlyCap=0');
    process.exit(1);
  }

  // Case B: hourly-cap rejection. Small hourLimit, no min delay, exhaust the cap.
  const capSenderId = 'lua-test-sender-cap';
  const capCountKey = `rl:count:${capSenderId}:${hourBucket}`;
  const capNextKey = `rl:next:${capSenderId}`;
  await redis.del(capCountKey, capNextKey);

  let lastResult;
  for (let i = 0; i < 4; i++) {
    lastResult = await redis.checkAndReserve(capCountKey, capNextKey, 3, 0, Date.now());
  }
  console.log('Hourly-cap case — 4th call against limit=3:', lastResult, '(expect allowed=0, isHourlyCap=1)');
  if (Number(lastResult[0]) !== 0 || Number(lastResult[2]) !== 1) {
    console.error('FAIL: expected hourly-cap rejection with isHourlyCap=1');
    process.exit(1);
  }

  console.log('\nPASS: Lua script correctly distinguishes hourly-cap vs min-delay rejections.');
  await redis.del(countKey, nextKey, capCountKey, capNextKey);
  redis.disconnect();
}

main().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
