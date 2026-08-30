import { Worker, Job, DelayedError } from 'bullmq';
import { redisConfig } from '../config/redis';
import { env } from '../config/env';
import { EmailRepository } from '../repositories/emailRepository';
import { EmailStatus } from '@prisma/client';
import { prisma } from '../config/prisma';
import { RateLimitService } from '../services/rateLimitService';
import { enqueueEmailJob, emailQueue } from '../queues/emailQueue';
import { EmailSenderService, PermanentEmailError } from '../services/emailSenderService';
import { ElasticsearchService } from '../services/elasticsearchService';
import { SlackNotificationService } from '../services/slackNotificationService';

export const emailWorker = new Worker(
  'email-send',
  async (job: Job, token?: string) => {
    const { emailId } = job.data;
    console.log(`[Worker] Processing job ${job.id} for email ${emailId} (Attempt ${job.attemptsMade + 1}/5)`);

    // 1. Fetch current email state from database
    const email = await EmailRepository.findById(emailId);
    if (!email) {
      console.warn(`[Worker] Email ${emailId} not found in database. Skipping.`);
      return;
    }

    // 2. If email is not in SCHEDULED or PROCESSING state, skip and complete job
    if (email.status !== EmailStatus.SCHEDULED && email.status !== EmailStatus.PROCESSING) {
      console.log(`[Worker] Email ${emailId} status is ${email.status}. Skipping send.`);
      return;
    }

    // Handle PROCESSING state (redelivery/stalled recovery case)
    if (email.status === EmailStatus.PROCESSING) {
      if (job.attemptsMade === 0) {
        console.warn(`[Worker] Email ${emailId} is in PROCESSING state in DB but attemptsMade is 0. Skipping.`);
        return;
      }

      // Pre-send existence check: if already sent, update DB to SENT (if needed) and ack
      if (email.sentAt || email.providerMessageId) {
        console.warn(`[Worker] Email ${emailId} was already sent (provider ID: ${email.providerMessageId}). Acknowledging job.`);
        await prisma.email.update({
          where: { id: emailId },
          data: { status: EmailStatus.SENT },
        });
        return;
      }

      console.warn(`[Worker] Redelivered job for email ${emailId} (stalled recovery). Attempting re-send.`);
    }

    let claimed = false;
    if (email.status === EmailStatus.SCHEDULED) {
      // 3. Run atomic rate-limiting / minimum-delay check via Redis Lua script
      const rateLimitResult = await RateLimitService.checkAndReserve(
        email.senderId,
        email.sender.hourlyLimit,
        env.MIN_EMAIL_DELAY_MS
      );

      if (!rateLimitResult.allowed) {
        console.log(`[Worker] Email ${emailId} rate limited. Rescheduling to timestamp ${rateLimitResult.retryAt}.`);

        // Only the hourly-cap rejection reason should trigger a Slack alert —
        // never the min-delay-not-elapsed reason. Fire-and-forget: this must
        // never block or fail the worker's own reschedule/fail logic below.
        if (rateLimitResult.isHourlyCap) {
          SlackNotificationService.notifyHourlyCapExceeded({
            userId: email.userId,
            senderId: email.senderId,
            senderEmail: email.sender.email,
            hourlyLimit: email.sender.hourlyLimit,
          }).catch(err => {
            console.error(`[Worker] Slack notification threw unexpectedly for sender ${email.senderId}:`, err.message);
          });
        }

        // Increment rescheduleCount in DB
        const updatedEmail = await EmailRepository.incrementRescheduleCount(emailId, rateLimitResult.retryAt);

        if (updatedEmail.rescheduleCount > 50) {
          console.error(`[Worker] Email ${emailId} exceeded reschedule limit of 50. Failing email.`);
          await prisma.email.update({
            where: { id: emailId },
            data: {
              status: EmailStatus.FAILED,
              failedAt: new Date(),
              error: 'Reschedule cap exceeded (50 attempts). Sender hourly limit or min delay is too restrictive.',
            },
          });
          return;
        }

        // Reschedule THIS SAME job to the future timestamp, in place.
        //
        // We deliberately do NOT remove() + re-add() a new job here: since
        // jobId === emailId, emailQueue.getJob(emailId) would fetch this
        // exact job while it is still active/locked in this very processor
        // call, and BullMQ cannot remove a job that holds an active lock on
        // itself. That throw was previously escaping uncaught, which BullMQ
        // treated as a real processing failure -- silently burning one of
        // the 5 built-in retry attempts every time a rate limit was hit,
        // eventually exhausting all 5 and marking the email FAILED even
        // though nothing was actually wrong with it.
        //
        // moveToDelayed() + throwing DelayedError is BullMQ's supported
        // mechanism for a job to postpone itself from inside its own
        // processor: it does not count as a failure, does not consume a
        // retry attempt, and requires no separate remove/re-add step.
        if (!token) {
          console.error(
            `[Worker] No lock token available to reschedule email ${emailId} in place; ` +
            `falling back to remove+re-add (should not normally happen).`
          );
          const existingJob = await emailQueue.getJob(emailId);
          if (existingJob) {
            await existingJob.remove();
          }
          await enqueueEmailJob(emailId, new Date(rateLimitResult.retryAt));
          return;
        }

        await job.moveToDelayed(rateLimitResult.retryAt, token);
        throw new DelayedError();
      }

      // 4. Atomically claim the job by transitioning status: SCHEDULED -> PROCESSING
      // This provides our idempotency guard
      claimed = await EmailRepository.updateStatus(emailId, EmailStatus.SCHEDULED, EmailStatus.PROCESSING, {
        attempts: job.attemptsMade + 1,
      });

      if (!claimed) {
        console.log(`[Worker] Email ${emailId} could not be claimed (already claimed or cancelled). Skipping.`);
        return;
      }
    } else {
      // If it was already PROCESSING, we proceed directly (already claimed)
      claimed = true;
    }

    try {
      // Call EmailSenderService to execute the real send
      const providerMessageId = await EmailSenderService.send(emailId);

      // Successfully sent
      const updated = await EmailRepository.updateStatus(emailId, EmailStatus.PROCESSING, EmailStatus.SENT, {
        sentAt: new Date(),
        providerMessageId,
      });

      if (!updated) {
        throw new Error('Failed to update email status to SENT in database');
      }

      console.log(`[Worker] Successfully sent and confirmed email ${emailId}`);
      // Index in Elasticsearch asynchronously (fire-and-forget, non-blocking)
      ElasticsearchService.indexEmail(emailId).catch(esErr => {
        console.error(`[Worker] Asynchronous Elasticsearch indexing failed for email ${emailId}:`, esErr.message);
      });
    } catch (err: any) {
      console.error(`[Worker] Error during send for email ${emailId}:`, err.message);

      if (err instanceof PermanentEmailError) {
        console.log(`[Worker] Permanent error encountered. Failing email ${emailId} immediately without retry.`);
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: EmailStatus.FAILED,
            failedAt: new Date(),
            error: err.message,
          },
        });
        
        // Index the permanent failure in Elasticsearch asynchronously
        ElasticsearchService.indexEmail(emailId).catch(esErr => {
          console.error(`[Worker] Asynchronous Elasticsearch indexing failed for email ${emailId}:`, esErr.message);
        });
        return; // Acknowledge job without retry
      }
      
      // Rethrow transient errors to trigger BullMQ's retry framework
      throw err;
    }
  },
  {
    connection: redisConfig as any,
    concurrency: env.WORKER_CONCURRENCY,
    lockDuration: 30000, // 30 seconds
    stalledInterval: 30000, // Check for stalled jobs every 30 seconds
    maxStalledCount: 2, // Fail a job if it stalls more than twice
  }
);

// Worker Event Listeners
emailWorker.on('completed', (job) => {
  console.log(`[Worker] Job completed: ${job.id}`);
});

emailWorker.on('failed', async (job, err) => {
  console.error(`[Worker] Job failed: ${job?.id}. Error: ${err.message}`);
  
  if (!job) return;

  const { emailId } = job.data;
  
  try {
    const email = await EmailRepository.findById(emailId);
    if (!email) return;

    // Check if we have exhausted all attempts (BullMQ attempts count starts at 1, max is 5)
    if (job.attemptsMade >= 5) {
      console.log(`[Worker] Exhausted all 5 attempts for email ${emailId}. Marking as FAILED.`);
      
      // Transition from PROCESSING to FAILED (if currently PROCESSING) or just force update if crashed
      // Note: If it crashed mid-flight, status will still be PROCESSING
      const currentStatus = email.status;
      if (currentStatus === EmailStatus.PROCESSING) {
        await EmailRepository.updateStatus(emailId, EmailStatus.PROCESSING, EmailStatus.FAILED, {
          failedAt: new Date(),
          error: err.message || 'All retry attempts exhausted',
        });
      } else {
        // Direct update in case of weird state
        await prisma.email.update({
          where: { id: emailId },
          data: {
            status: EmailStatus.FAILED,
            failedAt: new Date(),
            error: err.message || 'All retry attempts exhausted',
          },
        });
      }

      // Index the failed email in Elasticsearch asynchronously (fire-and-forget)
      ElasticsearchService.indexEmail(emailId).catch(esErr => {
        console.error(`[Worker] Asynchronous Elasticsearch indexing failed on final failure for email ${emailId}:`, esErr.message);
      });
    }
  } catch (dbErr: any) {
    console.error(`[Worker] Failed to mark email ${emailId} as FAILED in database:`, dbErr.message);
  }
});

emailWorker.on('error', (err) => {
  console.error('[Worker] Global worker error:', err);
});
