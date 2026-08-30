/**
 * Standalone test against a REAL local Redis instance (not mocked) that
 * exercises the exact dedup mechanism used by SlackNotificationService:
 *
 *   SET slack-notified:{senderId}:{hourBucket} 1 NX EX <secondsRemaining>
 *
 * It simulates ~50 workers hitting the hourly cap "simultaneously" for the
 * same sender/hour window (e.g. from a burst of 1000 queued jobs against a
 * low hourly limit with concurrency > 1) and asserts that exactly ONE of
 * them wins the dedup lock — i.e. exactly one would go on to call the real
 * Slack chat.postMessage API.
 *
 * Run with: REDIS_PORT=6399 node scripts/test-slack-dedup.js
 */
const Redis = require('ioredis');

const port = process.env.REDIS_PORT || 6399;
const redis = new Redis({ port });

async function main() {
  const senderId = 'test-sender-123';
  const hourBucket = Math.floor(Date.now() / 3600000);
  const dedupKey = `slack-notified:${senderId}:${hourBucket}`;
  const countKey = `rl:hourlycap-count:${senderId}:${hourBucket}`;

  // Clean slate
  await redis.del(dedupKey, countKey);

  const CONCURRENT_REJECTIONS = 50;

  const results = await Promise.all(
    Array.from({ length: CONCURRENT_REJECTIONS }, async () => {
      // Mirrors SlackNotificationService.notifyHourlyCapExceeded exactly:
      const affectedCount = await redis.incr(countKey);
      await redis.expire(countKey, 3600);

      const claimed = await redis.set(dedupKey, '1', 'EX', 3600, 'NX');
      return { claimed: claimed === 'OK', affectedCount };
    })
  );

  const winners = results.filter(r => r.claimed);
  const finalCount = await redis.get(countKey);

  console.log(`Simulated ${CONCURRENT_REJECTIONS} concurrent hourly-cap rejections for one sender/hour window.`);
  console.log(`Workers that won the dedup lock (would call real Slack API): ${winners.length}`);
  console.log(`Final rejection counter in Redis: ${finalCount}`);

  if (winners.length !== 1) {
    console.error(`FAIL: expected exactly 1 winner, got ${winners.length}`);
    process.exit(1);
  }
  if (Number(finalCount) !== CONCURRENT_REJECTIONS) {
    console.error(`FAIL: expected counter to equal ${CONCURRENT_REJECTIONS}, got ${finalCount}`);
    process.exit(1);
  }

  // Also verify: a second, later "burst" in the SAME window still does not re-notify.
  const secondBurst = await Promise.all(
    Array.from({ length: 10 }, async () => {
      const claimed = await redis.set(dedupKey, '1', 'EX', 3600, 'NX');
      return claimed === 'OK';
    })
  );
  const secondWinners = secondBurst.filter(Boolean).length;
  console.log(`A further 10 rejections in the SAME window produced ${secondWinners} additional notifications (expected 0).`);
  if (secondWinners !== 0) {
    console.error('FAIL: dedup key did not prevent a second notification within the same window.');
    process.exit(1);
  }

  // Verify a DIFFERENT hour bucket is not affected (dedup is scoped per sender+hour).
  const otherBucketKey = `slack-notified:${senderId}:${hourBucket + 1}`;
  await redis.del(otherBucketKey);
  const otherClaim = await redis.set(otherBucketKey, '1', 'EX', 3600, 'NX');
  console.log(`Different hour bucket claim result: ${otherClaim} (expected OK, proving windows are independent).`);
  if (otherClaim !== 'OK') {
    console.error('FAIL: dedup key incorrectly scoped across hour buckets.');
    process.exit(1);
  }

  console.log('\nPASS: Slack notification dedup mechanism is correct under concurrency.');
  await redis.del(dedupKey, countKey, otherBucketKey);
  redis.disconnect();
}

main().catch(err => {
  console.error('Test crashed:', err);
  process.exit(1);
});
