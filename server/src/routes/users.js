import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { updateProfile, searchUsers } from '../controllers/userController.js';

const router = Router();

router.patch('/me', requireAuth, updateProfile);
router.get('/search', requireAuth, searchUsers);

export default router;
