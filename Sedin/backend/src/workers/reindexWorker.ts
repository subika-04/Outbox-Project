import { Worker, Job } from 'bullmq';
import { redisConfig } from '../config/redis';
import { prisma } from '../config/prisma';
import { ElasticsearchService } from '../services/elasticsearchService';
import { EmailStatus } from '@prisma/client';

export const reindexWorker = new Worker(
  'email-reindex',
  async (job: Job) => {
    if (job.name !== 'reindex-sweep') return;

    console.log('[ReindexWorker] Starting ES reconciliation sweep...');

    try {
      // Find SENT/FAILED emails that failed to index (esIndexedAt is NULL)
      const unindexedEmails = await prisma.email.findMany({
        where: {
          status: { in: [EmailStatus.SENT, EmailStatus.FAILED] },
          esIndexedAt: null,
        },
        select: { id: true },
        take: 100, // Process in chunks of 100 max per run
      });

      if (unindexedEmails.length === 0) {
        console.log('[ReindexWorker] No unindexed emails found. Reconciliation finished.');
        return;
      }

      console.log(`[ReindexWorker] Found ${unindexedEmails.length} unindexed email(s). Reindexing...`);

      let successCount = 0;
      for (const email of unindexedEmails) {
        const success = await ElasticsearchService.indexEmail(email.id);
        if (success) successCount++;
      }

      console.log(`[ReindexWorker] Reconciliation finished. Successfully indexed ${successCount}/${unindexedEmails.length} email(s).`);
    } catch (error: any) {
      console.error('[ReindexWorker] Reconciliation sweep failed:', error.message);
      throw error;
    }
  },
  {
    connection: redisConfig as any,
    concurrency: 1, // Single thread is fine for background sweep
  }
);

reindexWorker.on('completed', (job) => {
  console.log(`[ReindexWorker] Job completed: ${job.id}`);
});

reindexWorker.on('failed', (job, err) => {
  console.error(`[ReindexWorker] Job failed: ${job?.id}. Error: ${err.message}`);
});
