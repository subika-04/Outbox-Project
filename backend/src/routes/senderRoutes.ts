import { Router } from 'express';
import { createSender, getSenders, updateSender, deleteSender } from '../controllers/senderController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth as any);

router.post('/', createSender as any);
router.get('/', getSenders as any);
router.put('/:id', updateSender as any);
router.delete('/:id', deleteSender as any);

export default router;
