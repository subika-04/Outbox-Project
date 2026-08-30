import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { prisma } from '../config/prisma';
import { SenderRepository } from '../repositories/senderRepository';

export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentEmailError';
  }
}

export class EmailSenderService {
  /**
   * Sends an email via the sender's SMTP configuration.
   */
  static async send(emailId: string): Promise<string> {
    // 1. Fetch email and decrypted sender details
    const email = await prisma.email.findUnique({
      where: { id: emailId },
      include: { sender: true },
    });

    if (!email) {
      throw new PermanentEmailError('Email record not found in database');
    }

    const { sender } = email;
    if (!sender) {
      throw new PermanentEmailError('Sender profile not found for this email');
    }

    // 2. Decrypt sender SMTP password at runtime
    let decryptedPassword = '';
    try {
      decryptedPassword = await SenderRepository.getDecryptedPassword(sender.id);
    } catch (err: any) {
      throw new PermanentEmailError(`Decryption of SMTP password failed: ${err.message}`);
    }

    // 3. Setup Nodemailer Transporter
    const transporter = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465, // True for 465, false for others
      auth: {
        user: sender.smtpUser,
        pass: decryptedPassword,
      },
      connectionTimeout: 10000, // 10 seconds timeout
      socketTimeout: 10000,
    });

    // 4. Send the mail
    try {
      console.log(`[EmailSenderService] Dispatching SMTP request for email ${emailId} to ${email.recipient}`);
      
      const mailOptions = {
        from: `"${sender.displayName}" <${sender.email}>`,
        to: email.recipient,
        subject: email.subject,
        html: email.body,
        text: email.body.replace(/<[^>]*>/g, ''), // Basic HTML strip for text version
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailSenderService] Email ${emailId} successfully sent. MessageID: ${info.messageId}`);
      
      return info.messageId || `smtp-success-${crypto.randomUUID()}`;
    } catch (error: any) {
      this.handleSmtpError(error);
    }
  }

  /**
   * Classifies SMTP errors as permanent vs transient.
   */
  private static handleSmtpError(error: any): never {
    const errorMessage = error.message || '';
    const errorCode = error.code || '';
    const responseCode = parseInt(error.responseCode || '0', 10);

    console.error(`[EmailSenderService] SMTP Send Exception: Code=${errorCode}, Resp=${responseCode}, Msg=${errorMessage}`);

    // Permanent errors: address rejected, syntax errors, or bad recipient format
    if (
      errorCode === 'EENVELOPE' || // Recipient address rejected
      errorMessage.includes('Invalid recipient') ||
      errorMessage.includes('malformed') ||
      responseCode === 501 || // Syntax error in parameters or arguments
      responseCode === 550 || // Mailbox unavailable / No such user
      responseCode === 553 || // Requested action not taken: mailbox name not allowed
      responseCode === 554 || // Transaction failed (permanent)
      responseCode === 555    // Destination address does not support SMTPUTF8
    ) {
      throw new PermanentEmailError(`Permanent SMTP failure: ${errorMessage}`);
    }

    // All other errors (timeouts, temporary auth lockouts, 4xx, network issues) are treated as transient
    throw new Error(`Transient SMTP failure: ${errorMessage}`);
  }
}
