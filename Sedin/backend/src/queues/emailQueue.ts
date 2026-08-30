import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis';

export const EMAIL_QUEUE_NAME = 'email-send';

// Define the general email send queue
export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConfig as any,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 86400, // Keep completed jobs for 24 hours
      count: 5000, // Limit maximum count of completed jobs to keep
    },
    removeOnFail: false, // Keep failures visible in Bull Board for auditing
  },
});

export const enqueueEmailJob = async (emailId: string, scheduledAt: Date) => {
  const now = Date.now();
  const runAt = new Date(scheduledAt).getTime();
  const delay = Math.max(0, runAt - now);

  const job = await emailQueue.add(
    'send',
    { emailId },
    {
      jobId: emailId, // De-duplication key at the BullMQ level
      delay, // Wait until scheduled time
    }
  );

  return job.id;
};
