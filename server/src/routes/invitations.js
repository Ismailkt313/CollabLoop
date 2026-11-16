import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listInvitations, respondToInvitation } from '../controllers/invitationController.js';

const router = Router();

router.get('/', requireAuth, listInvitations);
router.post('/:id/respond', requireAuth, respondToInvitation);

export default router;
