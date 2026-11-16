import { User, ProjectMember, Invitation } from '../models/index.js';

/**
 * GET /invitations
 * List all pending invitations for the authenticated user.
 */
export async function listInvitations(req, res) {
  const invitations = await Invitation.find({
    invitedUser: req.user.id,
    status: 'pending',
  })
    .populate('projectId', 'name thumbnail')
    .populate('invitedBy', 'name username');

  res.json({ invitations });
}

/**
 * POST /projects/:projectId/invitations
 * Invite a user to the project by username.
 */
export async function createInvitation(req, res) {
  const user = await User.findOne({
    username: String(req.body.username || '').replace(/^@/, '').toLowerCase(),
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (await ProjectMember.exists({ projectId: req.params.projectId, userId: user.id })) {
    return res.status(409).json({ error: 'User is already a project member' });
  }

  const existing = await Invitation.findOne({
    projectId: req.params.projectId,
    invitedUser: user.id,
    status: 'pending',
  });

  if (existing) {
    return res.status(409).json({ error: 'Invitation is already pending' });
  }

  const invitation = await Invitation.create({
    projectId: req.params.projectId,
    invitedBy: req.user.id,
    invitedUser: user.id,
  });

  res.status(201).json({ invitation });
}

/**
 * POST /invitations/:id/respond
 * Accept or reject a pending invitation.
 */
export async function respondToInvitation(req, res) {
  const invitation = await Invitation.findOne({
    _id: req.params.id,
    invitedUser: req.user.id,
    status: 'pending',
  });

  if (!invitation) {
    return res.status(404).json({ error: 'Pending invitation not found' });
  }

  if (!['accepted', 'rejected'].includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid response' });
  }

  invitation.status = req.body.status;
  invitation.respondedAt = new Date();
  await invitation.save();

  if (invitation.status === 'accepted') {
    await ProjectMember.create({
      projectId: invitation.projectId,
      userId: req.user.id,
      projectRole: 'member',
      teamFunction: 'Other',
      status: 'active',
      joinedAt: new Date(),
    });
  }

  res.json({ invitation });
}
