import { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { AuthenticatedRequest } from '../middleware/authMiddleware';

export const googleLogin = (req: Request, res: Response) => {
  // Generate random state to protect against CSRF
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  // Development mock bypass
  if (env.GOOGLE_CLIENT_ID === 'mock_google_id') {
    const callbackUrl = new URL(env.GOOGLE_CALLBACK_URL);
    callbackUrl.searchParams.set('code', 'mock_auth_code_12345');
    callbackUrl.searchParams.set('state', state);
    return res.redirect(callbackUrl.toString());
  }

  const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  googleAuthUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  googleAuthUrl.searchParams.set('redirect_uri', env.GOOGLE_CALLBACK_URL);
  googleAuthUrl.searchParams.set('response_type', 'code');
  googleAuthUrl.searchParams.set('scope', 'openid profile email');
  googleAuthUrl.searchParams.set('state', state);
  googleAuthUrl.searchParams.set('access_type', 'offline');
  googleAuthUrl.searchParams.set('prompt', 'select_account');

  res.redirect(googleAuthUrl.toString());
};

export const googleCallback = async (req: Request, res: Response) => {
  const { code, state } = req.query;

  // Verify CSRF state
  if (!state || state !== req.session.oauthState) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid state parameter. CSRF validation failed.',
      },
    });
  }

  // Clear state from session
  delete req.session.oauthState;

  try {
    let email = '';
    let googleId = '';
    let name = '';
    let avatarUrl = '';

    if (env.GOOGLE_CLIENT_ID === 'mock_google_id' && code === 'mock_auth_code_12345') {
      // Mock User Data for local development
      googleId = 'mock_google_user_id_999';
      email = 'dev-user@example.com';
      name = 'Developer Admin';
      avatarUrl = 'https://lh3.googleusercontent.com/a/default-user=s96-c';
    } else {
      // 1. Exchange authorization code for tokens
      const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      });

      const { access_token } = tokenResponse.data;

      // 2. Fetch user profile from Google
      const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });

      const profile = userInfoResponse.data;
      googleId = profile.sub;
      email = profile.email;
      name = profile.name || profile.given_name || 'Google User';
      avatarUrl = profile.picture || '';
    }

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Google account email is required but was not returned.',
        },
      });
    }

    // 3. Upsert user in database
    const user = await prisma.user.upsert({
      where: { googleId },
      update: {
        name,
        email,
        avatarUrl: avatarUrl || null,
      },
      create: {
        googleId,
        name,
        email,
        avatarUrl: avatarUrl || null,
      },
    });

    // 4. Set session
    req.session.userId = user.id;

    // Redirect to frontend dashboard (default dev port is 5173)
    const frontendUrl = process.env.NODE_ENV === 'production' ? '/' : 'http://localhost:5173/';
    res.redirect(frontendUrl);
  } catch (error: any) {
    console.error('OAuth Callback Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Google login failed.',
        details: error.response?.data || error.message,
      },
    });
  }
};

export const getMe = (req: AuthenticatedRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      user: req.user,
    },
  });
};

export const logout = (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not log out of session.',
        },
      });
    }

    res.clearCookie('connect.sid', {
      path: '/',
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({
      success: true,
      message: 'Logged out successfully.',
    });
  });
};
