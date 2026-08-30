import { Router } from 'express';
import { scheduleEmails, getEmails, cancelEmail, retryEmail, searchEmails } from '../controllers/emailController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.post('/schedule', scheduleEmails as any);
router.get('/search', searchEmails as any);
router.get('/', getEmails as any);
router.post('/:id/cancel', cancelEmail as any);
router.post('/:id/retry', retryEmail as any);

export default router;
