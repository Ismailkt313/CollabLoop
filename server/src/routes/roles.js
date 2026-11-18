import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listRoles, createRole } from '../controllers/roleController.js';

const router = Router();

router.get('/', requireAuth, listRoles);
router.post('/', requireAuth, createRole);

export default router;
