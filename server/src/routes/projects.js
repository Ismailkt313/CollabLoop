import { Router } from 'express';
import { requireAuth, requireMembership, requireManager, requireOwner } from '../middleware/auth.js';
import {
  listProjects,
  createProject,
  getProject,
  getProjectWorkspaces,
  getRoleWorkspace,
  getProjectSettings,
  updateProject,
  archiveProject,
  unarchiveProject,
  deleteProject,
} from '../controllers/projectController.js';
import { listMembers, updateMember, removeMember } from '../controllers/memberController.js';
import {
  createInvitation,
  listProjectInvitations,
  cancelInvitation,
  resendInvitation,
} from '../controllers/invitationController.js';
import {
  listChannels,
  createChannel,
  updateChannel,
  deleteChannel,
  markChannelAsRead,
  getUnreadSummary,
} from '../controllers/channelController.js';
import {
  listMessages,
  createMessage,
  updateMessage,
  deleteMessage,
} from '../controllers/messageController.js';
import {
  listResources,
  createResource,
  listRoleResources,
  createRoleResource,
  deleteResource,
  listDocuments,
  createDocument,
  listRoleDocuments,
  createRoleDocument,
  deleteDocument,
} from '../controllers/resourceController.js';
import {
  signUpload,
  uploadMiddleware,
  uploadDirectRoleResource,
  uploadDirectRoleDocument,
} from '../controllers/uploadController.js';

const router = Router();

// ── Projects ────────────────────────────────────────────────────────────────
router.get('/', requireAuth, listProjects);
router.post('/', requireAuth, createProject);
router.get('/:projectId', requireAuth, requireMembership, getProject);
router.patch('/:projectId', requireAuth, requireMembership, requireManager, updateProject);
router.get('/:projectId/settings', requireAuth, requireMembership, requireManager, getProjectSettings);
router.get('/:projectId/workspaces', requireAuth, requireMembership, getProjectWorkspaces);
router.get('/:projectId/workspaces/:roleId', requireAuth, requireMembership, getRoleWorkspace);
router.post('/:projectId/archive', requireAuth, requireMembership, requireOwner, archiveProject);
router.post('/:projectId/unarchive', requireAuth, requireMembership, requireOwner, unarchiveProject);
router.delete('/:projectId', requireAuth, requireMembership, requireOwner, deleteProject);

// ── Role Workspace Direct Uploads (Multipart -> Node -> Cloudinary -> MongoDB) ──
router.post('/:projectId/workspaces/:roleId/resources/upload', requireAuth, requireMembership, uploadMiddleware.single('file'), uploadDirectRoleResource);
router.post('/:projectId/workspaces/:roleId/documents/upload', requireAuth, requireMembership, uploadMiddleware.single('file'), uploadDirectRoleDocument);

// ── Role Workspace Upload Signatures ───────────────────────────────────────
router.post('/:projectId/workspaces/:roleId/resources/upload-signature', requireAuth, requireMembership, signUpload);
router.post('/:projectId/workspaces/:roleId/documents/upload-signature', requireAuth, requireMembership, signUpload);

// ── Role Workspace Resources & Documents ───────────────────────────────────
router.get('/:projectId/workspaces/:roleId/resources', requireAuth, requireMembership, listRoleResources);
router.post('/:projectId/workspaces/:roleId/resources', requireAuth, requireMembership, createRoleResource);
router.delete('/:projectId/workspaces/:roleId/resources/:resourceId', requireAuth, requireMembership, deleteResource);
router.get('/:projectId/workspaces/:roleId/documents', requireAuth, requireMembership, listRoleDocuments);
router.post('/:projectId/workspaces/:roleId/documents', requireAuth, requireMembership, createRoleDocument);
router.delete('/:projectId/workspaces/:roleId/documents/:documentId', requireAuth, requireMembership, deleteDocument);

// ── General Project Resources & Documents ───────────────────────────────────
router.get('/:projectId/resources', requireAuth, requireMembership, listResources);
router.post('/:projectId/resources', requireAuth, requireMembership, createResource);
router.delete('/:projectId/resources/:resourceId', requireAuth, requireMembership, deleteResource);

router.get('/:projectId/documents', requireAuth, requireMembership, listDocuments);
router.post('/:projectId/documents', requireAuth, requireMembership, createDocument);
router.delete('/:projectId/documents/:documentId', requireAuth, requireMembership, deleteDocument);

// ── Members ─────────────────────────────────────────────────────────────────
router.get('/:projectId/members', requireAuth, requireMembership, listMembers);
router.patch('/:projectId/members/:memberId', requireAuth, requireMembership, requireManager, updateMember);
router.delete('/:projectId/members/:memberId', requireAuth, requireMembership, requireManager, removeMember);

// ── Invitations (project-scoped) ────────────────────────────────────────────
router.get('/:projectId/invitations', requireAuth, requireMembership, requireManager, listProjectInvitations);
router.post('/:projectId/invitations', requireAuth, requireMembership, requireManager, createInvitation);
router.delete('/:projectId/invitations/:invitationId', requireAuth, requireMembership, requireManager, cancelInvitation);
router.post('/:projectId/invitations/:invitationId/resend', requireAuth, requireMembership, requireManager, resendInvitation);

// ── Channels ────────────────────────────────────────────────────────────────
router.get('/:projectId/channels', requireAuth, requireMembership, listChannels);
router.post('/:projectId/channels', requireAuth, requireMembership, requireManager, createChannel);
router.patch('/:projectId/channels/:channelId', requireAuth, requireMembership, requireManager, updateChannel);
router.delete('/:projectId/channels/:channelId', requireAuth, requireMembership, requireManager, deleteChannel);
router.post('/:projectId/channels/:channelId/read', requireAuth, requireMembership, markChannelAsRead);
router.get('/:projectId/unread-summary', requireAuth, requireMembership, getUnreadSummary);

// ── Messages ────────────────────────────────────────────────────────────────
router.get('/:projectId/messages', requireAuth, requireMembership, listMessages);
router.post('/:projectId/messages', requireAuth, requireMembership, createMessage);
router.patch('/:projectId/messages/:messageId', requireAuth, requireMembership, updateMessage);
router.delete('/:projectId/messages/:messageId', requireAuth, requireMembership, deleteMessage);

// ── Uploads ─────────────────────────────────────────────────────────────────
router.post('/:projectId/uploads/sign', requireAuth, requireMembership, signUpload);
router.post('/:projectId/chat/upload-signature', requireAuth, requireMembership, signUpload);

export default router;
