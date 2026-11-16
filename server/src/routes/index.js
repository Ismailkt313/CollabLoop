import { Router } from 'express';
import authRoutes from './auth.js';
import userRoutes from './users.js';
import projectRoutes from './projects.js';
import invitationRoutes from './invitations.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/projects', projectRoutes);
router.use('/invitations', invitationRoutes);

export default router;
