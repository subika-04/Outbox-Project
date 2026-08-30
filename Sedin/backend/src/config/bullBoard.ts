import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../queues/emailQueue';
import { reindexQueue } from '../queues/reindexQueue';

const BULL_BOARD_BASE_PATH = '/admin/queues';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath(BULL_BOARD_BASE_PATH);

createBullBoard({
  queues: [new BullMQAdapter(emailQueue), new BullMQAdapter(reindexQueue)],
  serverAdapter,
});

// Access control is NOT handled here — server.ts mounts this router behind
// `requireAdmin` (session auth + single ADMIN_EMAIL check). This module only
// wires up the dashboard itself.
export const bullBoardRouter = serverAdapter.getRouter();
export { BULL_BOARD_BASE_PATH };
