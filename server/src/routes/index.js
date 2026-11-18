import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import projectRoutes from './projects.js';
import invitationRoutes from './invitations.js';
import roleRoutes from './roles.js';
import { signUpload } from '../controllers/uploadController.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/invitations', invitationRoutes);
router.use('/roles', roleRoutes);
router.post('/uploads/sign', requireAuth, signUpload);

export default router;