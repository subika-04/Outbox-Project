/**
 * Integration test for the /admin/queues gate.
 *
 * Real: Express app, express-session + connect-redis against a real local
 * Redis, the real `requireAdmin` middleware, the real `bullBoardRouter`
 * (backed by real BullMQ Queue instances pointed at the same real Redis).
 *
 * Stubbed (only because no MySQL is available in this sandbox): the single
 * `prisma.user.findUnique` call inside `requireAuth`, patched on the real
 * `prisma` export the app itself uses. The `requireAuth`/`requireAdmin`
 * middleware logic under test is completely untouched.
 *
 * Run with: REDIS_PORT=6399 npx ts-node --transpile-only scripts/test-bullboard-admin.ts
 */
process.env.DATABASE_URL = 'mysql://user:pass@localhost:3306/db';
process.env.GOOGLE_CLIENT_ID = 'x';
process.env.GOOGLE_CLIENT_SECRET = 'x';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:9000/auth/google/callback';
process.env.SLACK_CLIENT_ID = 'x';
process.env.SLACK_CLIENT_SECRET = 'x';
process.env.SLACK_REDIRECT_URI = 'http://localhost:9000/api/slack/callback';
process.env.SESSION_SECRET = 'x'.repeat(20);
process.env.ENCRYPTION_KEY = 'x'.repeat(32);
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.REDIS_HOST = '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6399';
process.env.REDIS_PASSWORD = '';

// --- Stub only prisma.user.findUnique (no real MySQL in this sandbox) ---
// We still construct the REAL PrismaClient (via the real config/prisma.ts
// module the app itself uses) but override just the one method the
// middleware under test calls, so requireAuth/requireAdmin run unmodified.
import { prisma } from '../src/config/prisma';

const users: Record<string, { id: string; email: string; name: string; avatarUrl: string | null }> = {
  'user-admin': { id: 'user-admin', email: 'admin@example.com', name: 'Admin', avatarUrl: null },
  'user-regular': { id: 'user-regular', email: 'someone@example.com', name: 'Regular User', avatarUrl: null },
};
(prisma as any).user = {
  findUnique: async ({ where: { id } }: any) => users[id] || null,
};

// This sandbox's vendored Prisma client was generated on Windows; the
// PrismaClient constructor kicks off an async engine-resolution check in the
// background that rejects on this Linux sandbox regardless of the stub
// below. That's an environment artifact (see schema.prisma binaryTargets
// fix), not something under test here, so we swallow it and keep going.
process.on('unhandledRejection', (reason: any) => {
  if (String(reason?.message || reason).includes('Query Engine')) return;
  console.error('Unexpected unhandled rejection:', reason);
  process.exit(1);
});

import express from 'express';
import session from 'express-session';
import RedisStore from 'connect-redis';
import Redis from 'ioredis';
import http from 'http';

async function main() {
  const redisConnection = new Redis({ host: '127.0.0.1', port: Number(process.env.REDIS_PORT) });

  const { requireAdmin } = require('../src/middleware/authMiddleware');
  const { bullBoardRouter, BULL_BOARD_BASE_PATH } = require('../src/config/bullBoard');

  const app = express();
  app.use(
    session({
      store: new RedisStore({ client: redisConnection, prefix: 'test-session:' }),
      secret: 'test-secret',
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false, httpOnly: true, sameSite: 'lax', maxAge: 60000 },
    })
  );

  // Test-only helper to set a session's userId directly (stand-in for a real
  // login, which we can't do here without MySQL + real Google OAuth).
  app.get('/__test_login/:userId', (req: any, res) => {
    req.session.userId = req.params.userId;
    req.session.save(() => res.json({ ok: true }));
  });

  app.use(BULL_BOARD_BASE_PATH, requireAdmin, bullBoardRouter);

  const server = await new Promise<http.Server>(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = (server.address() as any).port;
  const base = `http://127.0.0.1:${port}`;

  const fetchWithCookies = async (url: string, cookie?: string) => {
    const res = await fetch(url, { headers: cookie ? { Cookie: cookie } : {}, redirect: 'manual' });
    return res;
  };

  // 1. No session at all -> 401
  const anon = await fetchWithCookies(`${base}${BULL_BOARD_BASE_PATH}`);
  console.log('No session ->', anon.status, '(expect 401)');
  if (anon.status !== 401) throw new Error(`FAIL: expected 401, got ${anon.status}`);

  // 2. Regular (non-admin) user -> 403
  const loginRegular = await fetch(`${base}/__test_login/user-regular`);
  const regularCookie = loginRegular.headers.get('set-cookie')?.split(';')[0];
  const regular = await fetchWithCookies(`${base}${BULL_BOARD_BASE_PATH}`, regularCookie);
  console.log('Non-admin session ->', regular.status, '(expect 403)');
  if (regular.status !== 403) throw new Error(`FAIL: expected 403, got ${regular.status}`);

  // 3. Admin user (email matches ADMIN_EMAIL) -> reaches the real Bull Board UI
  const loginAdmin = await fetch(`${base}/__test_login/user-admin`);
  const adminCookie = loginAdmin.headers.get('set-cookie')?.split(';')[0];
  const admin = await fetchWithCookies(`${base}${BULL_BOARD_BASE_PATH}`, adminCookie);
  const adminBody = await admin.text();
  console.log('Admin session ->', admin.status, '(expect 200, real Bull Board HTML)');
  if (admin.status !== 200) throw new Error(`FAIL: expected 200 for admin, got ${admin.status}`);
  if (!adminBody.includes('bull-board') && !adminBody.includes('Bull Board') && !adminBody.toLowerCase().includes('queue')) {
    throw new Error('FAIL: admin response does not look like the real Bull Board UI');
  }

  console.log('\nPASS: /admin/queues correctly returns 401 (no session), 403 (non-admin), 200 (real ADMIN_EMAIL match).');

  server.close();
  redisConnection.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
