import { Router } from 'express';
import { googleLogin, googleCallback, getMe, logout } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);
router.get('/me', requireAuth as any, getMe as any);
router.post('/logout', logout);

export default router;
