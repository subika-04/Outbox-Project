import axios from 'axios';
import { prisma } from '../config/prisma';
import { redisConnection } from '../config/redis';
import { decrypt } from '../utils/crypto';
import { RateLimitService } from './rateLimitService';

export interface HourlyCapNotificationParams {
  userId: string;
  senderId: string;
  senderEmail: string;
  hourlyLimit: number;
}

export class SlackNotificationService {
  /**
   * Fires (at most once per sender/hour window) a real Slack chat.postMessage
   * call when the Lua rate-limit script rejects a job because the HOURLY CAP
   * was exceeded (never for the min-delay-not-elapsed rejection).
   *
   * Fail-safe by design: every failure path here is caught and logged, never
   * thrown, so a Slack outage / missing connection can never affect the
   * email job's own status transition.
   */
  static async notifyHourlyCapExceeded(params: HourlyCapNotificationParams): Promise<void> {
    const { userId, senderId, senderEmail, hourlyLimit } = params;

    try {
      const now = Date.now();
      const hourBucket = Math.floor(now / 3600000);
      const windowStart = new Date(hourBucket * 3600000);
      const windowEnd = new Date((hourBucket + 1) * 3600000);
      const secondsRemaining = Math.max(1, await RateLimitService.getSecondsRemainingInHour());

      // Running tally of how many rejections have been observed for this
      // sender/hour window so far. Incremented on every hourly-cap rejection,
      // regardless of whether this particular call wins the notification
      // dedup lock below, so the count reflects the real state at the moment
      // of the check even under concurrent workers.
      const countKey = `rl:hourlycap-count:${senderId}:${hourBucket}`;
      const affectedCount = await redisConnection.incr(countKey);
      await redisConnection.expire(countKey, secondsRemaining);

      // Skip silently if the user never connected Slack. Never throw.
      const connection = await prisma.slackConnection.findUnique({ where: { userId } });
      if (!connection) {
        return;
      }

      // Atomic dedup: only the worker that wins this SET ... NX EX sends the
      // real Slack message for this sender/hour window.
      const dedupKey = `slack-notified:${senderId}:${hourBucket}`;
      const claimed = await (redisConnection as any).set(dedupKey, '1', 'EX', secondsRemaining, 'NX');
      if (claimed !== 'OK') {
        return; // Another worker already claimed/sent this window's notification.
      }

      const accessToken = decrypt(connection.accessTokenEnc);

      const text = [
        ':rotating_light: *Hourly send limit reached*',
        `*Sender:* ${senderEmail}`,
        `*Hourly limit:* ${hourlyLimit} emails/hour`,
        `*Window:* ${windowStart.toISOString()} – ${windowEnd.toISOString()}`,
        `*Emails rescheduled in this event:* ${affectedCount}`,
        `*Detected at:* ${new Date(now).toISOString()}`,
      ].join('\n');

      const response = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: connection.channelId,
          text,
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          timeout: 10000,
        }
      );

      if (!response.data.ok) {
        console.error(`[SlackNotification] Slack API rejected message: ${response.data.error}`);
        return;
      }

      console.log(
        `[SlackNotification] Rate-limit alert posted to Slack for sender ${senderId} (window ${windowStart.toISOString()})`
      );
    } catch (err: any) {
      // Never let a Slack/notification failure affect the email job.
      console.error('[SlackNotification] Failed to send hourly-cap alert:', err.message);
    }
  }
}
