import { Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { encrypt, decrypt } from '../utils/crypto';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const connectSlack = (req: AuthenticatedRequest, res: Response) => {
  const state = crypto.randomBytes(16).toString('hex');
  req.session.slackState = state;

  const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
  slackAuthUrl.searchParams.set('client_id', env.SLACK_CLIENT_ID);
  slackAuthUrl.searchParams.set('scope', 'chat:write,incoming-webhook'); // Bot scope for posting + channel picker via "Add to Slack"
  slackAuthUrl.searchParams.set('redirect_uri', env.SLACK_REDIRECT_URI);
  slackAuthUrl.searchParams.set('state', state);

  res.redirect(slackAuthUrl.toString());
};

export const slackCallback = async (req: AuthenticatedRequest, res: Response) => {
  const { code, state } = req.query;

  // Verify CSRF state
  if (!state || state !== req.session.slackState) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid state parameter. CSRF validation failed.',
      },
    });
  }

  if (!code) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Missing authorization code from Slack.',
      },
    });
  }

  delete req.session.slackState;

  try {
    const userId = req.user!.id;

    // 1. Exchange OAuth code for a real access token
    const response = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        code: String(code),
        client_id: env.SLACK_CLIENT_ID,
        client_secret: env.SLACK_CLIENT_SECRET,
        redirect_uri: env.SLACK_REDIRECT_URI,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }

    const data = response.data;
    const accessToken: string = data.access_token;
    const teamId: string = data.team.id;
    const teamName: string = data.team.name;

    // Channel ID comes from the "Add to Slack" incoming-webhook channel picker.
    // We require it explicitly rather than guessing a channel name, since chat.postMessage
    // needs a real channel ID (or the bot must be a member of a named channel).
    const channelId: string = data.incoming_webhook?.channel_id;

    if (!channelId) {
      throw new Error(
        'Slack did not return a channel_id. Make sure your Slack app requests the "incoming-webhook" scope so the user can pick a channel during install.'
      );
    }

    // 2. Encrypt token at rest
    const accessTokenEnc = encrypt(accessToken);

    // 3. Upsert Slack Connection in database
    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        teamId,
        teamName,
        channelId,
        accessTokenEnc,
      },
      create: {
        userId,
        teamId,
        teamName,
        channelId,
        accessTokenEnc,
      },
    });

    // Redirect to frontend dashboard (default dev port is 5173)
    const frontendUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
    res.redirect(frontendUrl);
  } catch (error: any) {
    console.error('Slack OAuth Callback Error:', error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Slack connection failed.',
        details: error.message,
      },
    });
  }
};

export const getSlackStatus = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: {
        teamName: true,
        channelId: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: {
        connected: !!connection,
        connection,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not fetch Slack connection status.',
        details: error.message,
      },
    });
  }
};

export const disconnectSlack = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    await prisma.slackConnection.deleteMany({
      where: { userId },
    });

    res.json({
      success: true,
      message: 'Slack integration disconnected successfully.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Could not disconnect Slack integration.',
        details: error.message,
      },
    });
  }
};
