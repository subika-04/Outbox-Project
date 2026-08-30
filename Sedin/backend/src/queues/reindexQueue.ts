import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis';

export const REINDEX_QUEUE_NAME = 'email-reindex';

export const reindexQueue = new Queue(REINDEX_QUEUE_NAME, {
  connection: redisConfig as any,
});

export const setupReindexRepeatableJob = async () => {
  // Add repeatable job that runs every 5 minutes (300,000 ms)
  // Deduplicate using a stable repeatable key
  await reindexQueue.add(
    'reindex-sweep',
    {},
    {
      repeat: {
        every: 300000, // 5 minutes
      },
      jobId: 'reindex-sweep-job',
    }
  );
  console.log('[ReindexQueue] Configured repeatable job for ES reconciliation (every 5 min)');
};
