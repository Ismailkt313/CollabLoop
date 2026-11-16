import { Router } from 'express';
import { requireAuth, requireMembership, requireManager } from '../middleware/auth.js';
import { listProjects, createProject, getProject } from '../controllers/projectController.js';
import { listMembers, updateMember } from '../controllers/memberController.js';
import { createInvitation } from '../controllers/invitationController.js';
import { listChannels, createChannel } from '../controllers/channelController.js';
import { listMessages } from '../controllers/messageController.js';
import { listResources, createResource, listDocuments, createDocument } from '../controllers/resourceController.js';
import { signUpload } from '../controllers/uploadController.js';

const router = Router();

// ── Projects ────────────────────────────────────────────────────────────────
router.get('/', requireAuth, listProjects);
router.post('/', requireAuth, createProject);
router.get('/:projectId', requireAuth, requireMembership, getProject);

// ── Members ─────────────────────────────────────────────────────────────────
router.get('/:projectId/members', requireAuth, requireMembership, listMembers);
router.patch('/:projectId/members/:memberId', requireAuth, requireMembership, requireManager, updateMember);

// ── Invitations (project-scoped) ────────────────────────────────────────────
router.post('/:projectId/invitations', requireAuth, requireMembership, requireManager, createInvitation);

// ── Channels ────────────────────────────────────────────────────────────────
router.get('/:projectId/channels', requireAuth, requireMembership, listChannels);
router.post('/:projectId/channels', requireAuth, requireMembership, requireManager, createChannel);

// ── Messages ────────────────────────────────────────────────────────────────
router.get('/:projectId/messages', requireAuth, requireMembership, listMessages);

// ── Uploads ─────────────────────────────────────────────────────────────────
router.post('/:projectId/uploads/sign', requireAuth, requireMembership, signUpload);

// ── Resources ───────────────────────────────────────────────────────────────
router.get('/:projectId/resources', requireAuth, requireMembership, listResources);
router.post('/:projectId/resources', requireAuth, requireMembership, createResource);

// ── Documents ───────────────────────────────────────────────────────────────
router.get('/:projectId/documents', requireAuth, requireMembership, listDocuments);
router.post('/:projectId/documents', requireAuth, requireMembership, createDocument);

export default router;
