/**
 * Calls the REAL slackCallback controller function directly (imported, not
 * reimplemented) with fabricated req/res objects to confirm CSRF state
 * validation actually rejects a missing or tampered `state` param, before
 * any network call to Slack is ever attempted.
 */
process.env.DATABASE_URL = process.env.DATABASE_URL || 'mysql://user:pass@localhost:3306/db';
process.env.GOOGLE_CLIENT_ID = 'x';
process.env.GOOGLE_CLIENT_SECRET = 'x';
process.env.GOOGLE_CALLBACK_URL = 'http://localhost:9000/auth/google/callback';
process.env.SLACK_CLIENT_ID = 'x';
process.env.SLACK_CLIENT_SECRET = 'x';
process.env.SLACK_REDIRECT_URI = 'http://localhost:9000/api/slack/callback';
process.env.SESSION_SECRET = 'x'.repeat(20);
process.env.ENCRYPTION_KEY = 'x'.repeat(32);
process.env.ADMIN_EMAIL = 'admin@example.com';

import { slackCallback } from '../src/controllers/slackController';

function makeRes() {
  let statusCode = 200;
  let body: any = null;
  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: any) {
      body = payload;
      return res;
    },
  };
  return { res, get statusCode() { return statusCode; }, get body() { return body; } };
}

async function main() {
  // Case 1: missing state param entirely
  {
    const h = makeRes();
    const req: any = { query: { code: 'somecode' }, session: { slackState: 'real-state-abc' } };
    await slackCallback(req, h.res);
    console.log('Missing state -> status:', h.statusCode, 'body:', h.body);
    if (h.statusCode !== 400) throw new Error('FAIL: missing state should be rejected with 400');
  }

  // Case 2: tampered/mismatched state param
  {
    const h = makeRes();
    const req: any = {
      query: { code: 'somecode', state: 'attacker-supplied-state' },
      session: { slackState: 'real-state-abc' },
    };
    await slackCallback(req, h.res);
    console.log('Tampered state -> status:', h.statusCode, 'body:', h.body);
    if (h.statusCode !== 400) throw new Error('FAIL: tampered state should be rejected with 400');
  }

  // Case 3: correct state should pass CSRF check and proceed to the code exchange
  // (which will fail with a network/API error since we're not hitting real Slack —
  // that's fine, we're only proving it gets PAST the state check).
  {
    const h = makeRes();
    const req: any = {
      query: { code: 'somecode', state: 'real-state-abc' },
      session: { slackState: 'real-state-abc' },
      user: { id: 'user-1' },
    };
    await slackCallback(req, h.res);
    console.log('Correct state -> status:', h.statusCode, 'body:', h.body);
    if (h.statusCode === 400 && h.body?.error?.message?.includes('CSRF')) {
      throw new Error('FAIL: correct state was incorrectly rejected as CSRF failure');
    }
  }

  console.log('\nPASS: real slackCallback controller correctly enforces CSRF state validation.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
