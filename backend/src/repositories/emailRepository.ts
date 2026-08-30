import { EmailStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface CreateEmailInput {
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: Date;
}

export class EmailRepository {
  private static isTransitionAllowed(from: EmailStatus, to: EmailStatus): boolean {
    if (from === EmailStatus.SCHEDULED && (to === EmailStatus.PROCESSING || to === EmailStatus.CANCELLED)) {
      return true;
    }
    if (from === EmailStatus.PROCESSING && (to === EmailStatus.SENT || to === EmailStatus.FAILED)) {
      return true;
    }
    if (from === EmailStatus.FAILED && to === EmailStatus.SCHEDULED) {
      return true;
    }
    return false;
  }

  static async createMany(userId: string, senderId: string, inputs: CreateEmailInput[]) {
    // Return all created rows so we can enqueue jobs for them
    const emailsData = inputs.map(input => ({
      userId,
      senderId,
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      scheduledAt: input.scheduledAt,
      status: EmailStatus.SCHEDULED,
    }));

    // MySQL and Prisma support createMany, but we want the IDs of the created rows.
    // In Prisma, we can run a transaction or a loop, or in MySQL we can create them and query them.
    // Since we need to know the IDs to enqueue them in BullMQ, let's create them sequentially or in a transaction.
    //Sequential creation inside a transaction returns the created records with IDs.
    return prisma.$transaction(
      emailsData.map(data => prisma.email.create({ data }))
    );
  }

  static async findById(id: string) {
    return prisma.email.findUnique({
      where: { id },
      include: {
        sender: {
          select: {
            email: true,
            displayName: true,
            hourlyLimit: true,
          },
        },
      },
    });
  }

  static async findManyByUserId(
    userId: string,
    params: {
      status?: EmailStatus;
      search?: string;
      skip?: number;
      take?: number;
    }
  ) {
    const whereClause: Prisma.EmailWhereInput = { userId };

    if (params.status) {
      whereClause.status = params.status;
    }

    if (params.search) {
      whereClause.OR = [
        { recipient: { contains: params.search } },
        { subject: { contains: params.search } },
        { body: { contains: params.search } },
      ];
    }

    const [emails, totalCount] = await prisma.$transaction([
      prisma.email.findMany({
        where: whereClause,
        orderBy: { scheduledAt: 'desc' },
        skip: params.skip ?? 0,
        take: params.take ?? 20,
        include: {
          sender: {
            select: {
              email: true,
              displayName: true,
            },
          },
        },
      }),
      prisma.email.count({ where: whereClause }),
    ]);

    return { emails, totalCount };
  }

  /**
   * Performs an atomic status update enforcing legal state transitions.
   * Returns true if the state was updated, false if transition was illegal or no row matched.
   */
  static async updateStatus(
    emailId: string,
    currentStatus: EmailStatus,
    targetStatus: EmailStatus,
    extraData: Prisma.EmailUpdateInput = {}
  ): Promise<boolean> {
    if (!this.isTransitionAllowed(currentStatus, targetStatus)) {
      throw new Error(`Forbidden status transition from ${currentStatus} to ${targetStatus}`);
    }

    const result = await prisma.email.updateMany({
      where: {
        id: emailId,
        status: currentStatus,
      },
      data: {
        status: targetStatus,
        ...extraData,
        updatedAt: new Date(),
      },
    });

    return result.count > 0;
  }

  static async incrementRescheduleCount(emailId: string, retryAtMs: number) {
    return prisma.email.update({
      where: { id: emailId },
      data: {
        rescheduleCount: { increment: 1 },
        scheduledAt: new Date(retryAtMs),
      },
    });
  }

  static async updateJobId(emailId: string, bullJobId: string) {
    return prisma.email.update({
      where: { id: emailId },
      data: { bullJobId },
    });
  }

  static async cancel(emailId: string, userId: string): Promise<boolean> {
    // Can only cancel SCHEDULED emails
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId },
    });

    if (!email) {
      throw new Error('Email not found or access denied');
    }

    if (email.status !== EmailStatus.SCHEDULED) {
      throw new Error('Only scheduled emails can be cancelled');
    }

    const updated = await this.updateStatus(emailId, EmailStatus.SCHEDULED, EmailStatus.CANCELLED);
    return updated;
  }

  static async prepareRetry(emailId: string, userId: string, scheduledAt: Date): Promise<boolean> {
    // Can only retry FAILED emails
    const email = await prisma.email.findFirst({
      where: { id: emailId, userId },
    });

    if (!email) {
      throw new Error('Email not found or access denied');
    }

    if (email.status !== EmailStatus.FAILED) {
      throw new Error('Only failed emails can be retried');
    }

    const updated = await this.updateStatus(emailId, EmailStatus.FAILED, EmailStatus.SCHEDULED, {
      attempts: { increment: 1 },
      rescheduleCount: 0, // Reset reschedule loop count for fresh manual retry
      scheduledAt,
      error: null,
      failedAt: null,
    });

    return updated;
  }
}
