import { Response } from 'express';
import { z } from 'zod';
import { SenderRepository } from '../repositories/senderRepository';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

const createSenderSchema = z.object({
  email: z.string().email('Invalid sender email format'),
  displayName: z.string().min(1, 'Display name is required'),
  smtpHost: z.string().min(1, 'SMTP host is required'),
  smtpPort: z.coerce.number().int().positive('SMTP port must be a positive integer'),
  smtpUser: z.string().min(1, 'SMTP username is required'),
  smtpPass: z.string().min(1, 'SMTP password is required'),
  hourlyLimit: z.coerce.number().int().min(1, 'Hourly limit must be at least 1').optional(),
});

const updateSenderSchema = z.object({
  displayName: z.string().min(1).optional(),
  smtpHost: z.string().min(1).optional(),
  smtpPort: z.coerce.number().int().positive().optional(),
  smtpUser: z.string().min(1).optional(),
  smtpPass: z.string().min(1).optional(),
  hourlyLimit: z.coerce.number().int().min(1).optional(),
  enabled: z.boolean().optional(),
});

export const createSender = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const validated = createSenderSchema.parse(req.body);

    const sender = await SenderRepository.create(userId, validated);
    
    res.status(201).json({
      success: true,
      message: 'Sender profile created successfully.',
      data: {
        sender: {
          id: sender.id,
          email: sender.email,
          displayName: sender.displayName,
          smtpHost: sender.smtpHost,
          smtpPort: sender.smtpPort,
          smtpUser: sender.smtpUser,
          hourlyLimit: sender.hourlyLimit,
          enabled: sender.enabled,
        },
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

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not create sender profile.',
        details: error.message,
      },
    });
  }
};

export const getSenders = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const senders = await SenderRepository.findManyByUserId(userId);
    
    res.json({
      success: true,
      data: { senders },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not retrieve sender profiles.',
        details: error.message,
      },
    });
  }
};

export const updateSender = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const validated = updateSenderSchema.parse(req.body);

    const sender = await SenderRepository.update(id, userId, validated);

    res.json({
      success: true,
      message: 'Sender profile updated successfully.',
      data: {
        sender: {
          id: sender.id,
          email: sender.email,
          displayName: sender.displayName,
          smtpHost: sender.smtpHost,
          smtpPort: sender.smtpPort,
          smtpUser: sender.smtpUser,
          hourlyLimit: sender.hourlyLimit,
          enabled: sender.enabled,
        },
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

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not update sender profile.',
        details: error.message,
      },
    });
  }
};

export const deleteSender = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await SenderRepository.delete(id, userId);

    res.json({
      success: true,
      message: 'Sender profile deleted successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not delete sender profile.',
        details: error.message,
      },
    });
  }
};
