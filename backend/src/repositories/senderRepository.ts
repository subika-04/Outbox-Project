import { prisma } from '../config/prisma';
import { encrypt, decrypt } from '../utils/crypto';

export interface CreateSenderInput {
  email: string;
  displayName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  hourlyLimit?: number;
}

export interface UpdateSenderInput {
  displayName?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  hourlyLimit?: number;
  enabled?: boolean;
}

export class SenderRepository {
  static async create(userId: string, input: CreateSenderInput) {
    const smtpPassEnc = encrypt(input.smtpPass);
    return prisma.sender.create({
      data: {
        userId,
        email: input.email,
        displayName: input.displayName,
        smtpHost: input.smtpHost,
        smtpPort: input.smtpPort,
        smtpUser: input.smtpUser,
        smtpPassEnc,
        hourlyLimit: input.hourlyLimit ?? 200,
        enabled: true,
      },
    });
  }

  static async findManyByUserId(userId: string) {
    return prisma.sender.findMany({
      where: { userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        smtpHost: true,
        smtpPort: true,
        smtpUser: true,
        hourlyLimit: true,
        enabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  static async findById(id: string) {
    return prisma.sender.findUnique({
      where: { id },
    });
  }

  static async getDecryptedPassword(senderId: string): Promise<string> {
    const sender = await prisma.sender.findUnique({
      where: { id: senderId },
      select: { smtpPassEnc: true },
    });
    if (!sender) {
      throw new Error('Sender not found');
    }
    return decrypt(sender.smtpPassEnc);
  }

  static async update(id: string, userId: string, input: UpdateSenderInput) {
    const updateData: any = { ...input };
    if (input.smtpPass) {
      updateData.smtpPassEnc = encrypt(input.smtpPass);
      delete updateData.smtpPass;
    }

    return prisma.sender.update({
      where: { id, userId },
      data: updateData,
    });
  }

  static async delete(id: string, userId: string) {
    return prisma.sender.delete({
      where: { id, userId },
    });
  }
}
