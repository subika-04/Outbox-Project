import { Response } from 'express';
import { z } from 'zod';
import { EmailStatus } from '@prisma/client';
import { EmailRepository } from '../repositories/emailRepository';
import { SenderRepository } from '../repositories/senderRepository';
import { enqueueEmailJob, emailQueue } from '../queues/emailQueue';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { ElasticsearchService } from '../services/elasticsearchService';

const scheduleEmailSchema = z.object({
  senderId: z.string().min(1, 'Sender profile is required'),
  recipients: z.array(z.string().email('Invalid recipient email')).min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  scheduledAt: z.string().refine(val => !isNaN(Date.parse(val)), {
    message: 'Invalid scheduled time format',
  }),
});

export const scheduleEmails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const validated = scheduleEmailSchema.parse(req.body);

    // 1. Verify sender exists and belongs to active user
    const sender = await SenderRepository.findById(validated.senderId);
    if (!sender || sender.userId !== userId) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Sender profile not found.',
        },
      });
    }

    if (!sender.enabled) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Sender profile is disabled.',
        },
      });
    }

    const scheduledDate = new Date(validated.scheduledAt);
    if (scheduledDate.getTime() < Date.now() - 60000) { // Allow up to 1-minute past skew
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Cannot schedule email in the past.',
        },
      });
    }

    // 2. Persist email records in MySQL (all start as SCHEDULED)
    const emailInputs = validated.recipients.map(recipient => ({
      recipient,
      subject: validated.subject,
      body: validated.body,
      scheduledAt: scheduledDate,
    }));

    const createdEmails = await EmailRepository.createMany(userId, sender.id, emailInputs);

    // 3. Enqueue BullMQ delayed jobs
    const enqueuedJobs = await Promise.all(
      createdEmails.map(async (email) => {
        const jobId = await enqueueEmailJob(email.id, email.scheduledAt);
        await EmailRepository.updateJobId(email.id, jobId!);
        return { emailId: email.id, jobId };
      })
    );

    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${createdEmails.length} email(s).`,
      data: {
        scheduled: enqueuedJobs.map(j => ({ id: j.emailId, jobId: j.jobId })),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed.',
          details: error.format(),
        },
      });
    }

    console.error('Email Schedule Error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not schedule emails.',
        details: error.message,
      },
    });
  }
};

export const getEmails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { status, search, page, limit } = req.query;

    const emailStatus = status ? (status as EmailStatus) : undefined;
    const searchString = search ? String(search) : undefined;
    
    const pageNum = Math.max(1, parseInt(String(page || '1'), 10));
    const limitNum = Math.max(1, Math.min(100, parseInt(String(limit || '20'), 10)));
    const skip = (pageNum - 1) * limitNum;

    const { emails, totalCount } = await EmailRepository.findManyByUserId(userId, {
      status: emailStatus,
      search: searchString,
      skip,
      take: limitNum,
    });

    res.json({
      success: true,
      data: {
        emails,
        pagination: {
          totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not retrieve emails.',
        details: error.message,
      },
    });
  }
};

export const cancelEmail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // 1. Atomically change DB status to CANCELLED
    const cancelledInDb = await EmailRepository.cancel(id, userId);

    if (cancelledInDb) {
      // 2. Remove job from BullMQ queue to prevent it running
      const job = await emailQueue.getJob(id);
      if (job) {
        await job.remove();
      }
    }

    res.json({
      success: true,
      message: 'Email scheduling cancelled successfully.',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: error.message || 'Could not cancel email scheduling.',
      },
    });
  }
};

export const retryEmail = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    // Set retry to execute immediately (or with minimal skew)
    const runAt = new Date();

    // 1. Reset state in DB to SCHEDULED and increment attempts
    const prepared = await EmailRepository.prepareRetry(id, userId, runAt);

    if (prepared) {
      // 2. Re-enqueue as a new job in BullMQ (always uses the same logical ID)
      const job = await emailQueue.getJob(id);
      if (job) {
        await job.remove(); // Remove old failure record from active queue structure if exists
      }
      await enqueueEmailJob(id, runAt);
    }

    res.json({
      success: true,
      message: 'Email retry scheduled successfully.',
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: error.message || 'Could not retry email.',
      },
    });
  }
};

export const searchEmails = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { q } = req.query;
    const queryText = q ? String(q) : '';

    const { results, isElasticsearchDown } = await ElasticsearchService.search(userId, queryText);

    res.json({
      success: true,
      data: {
        results,
        isElasticsearchDown,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Search query failed.',
        details: error.message,
      },
    });
  }
};
