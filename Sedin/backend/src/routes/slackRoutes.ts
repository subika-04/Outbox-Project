import { Router } from 'express';
import { connectSlack, slackCallback, getSlackStatus, disconnectSlack } from '../controllers/slackController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.get('/connect', connectSlack as any);
router.get('/callback', slackCallback as any);
router.get('/status', getSlackStatus as any);
router.post('/disconnect', disconnectSlack as any);

export default router;
