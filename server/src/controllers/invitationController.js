import { User, ProjectMember, Invitation, ContributorRole } from '../models/index.js';



export async function listInvitations(req, res, next) {
  try {
    const invitations = await Invitation.find({
      invitedUser: req.user.id,
      status: 'pending',
    })
      .populate('projectId', 'name thumbnail category description')
      .populate('invitedBy', 'name username avatar')
      .populate('contributorRoleId', 'name description imageUrl');

    res.json({ invitations });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/invitations
 * Invite a user to the project by username or userId.
 */
export async function createInvitation(req, res, next) {
  try {
    let user;
    if (req.body.userId) {
      user = await User.findById(req.body.userId);
    } else {
      const username = String(req.body.username || '').replace(/^@/, '').toLowerCase().trim();
      user = await User.findOne({ username });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === req.user.id.toString()) {
      return res.status(400).json({ error: 'You cannot invite yourself to your project' });
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

    let contributorRoleId = req.body.contributorRoleId || null;
    if (contributorRoleId) {
      const roleExists = await ContributorRole.exists({ _id: contributorRoleId });
      if (!roleExists) {
        return res.status(400).json({ error: 'Assigned contributor role does not exist' });
      }
    }

    const invitation = await Invitation.create({
      projectId: req.params.projectId,
      invitedBy: req.user.id,
      invitedUser: user.id,
      contributorRoleId,
      status: 'pending',
    });

    res.status(201).json({ invitation });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /invitations/:id/respond
 * Accept or reject a pending invitation.
 * On acceptance, adds user as an active ProjectMember with their assigned contributor role.
 */
export async function respondToInvitation(req, res, next) {
  try {
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
      const existingMember = await ProjectMember.findOne({
        projectId: invitation.projectId,
        userId: req.user.id,
      });

      if (!existingMember) {
        let teamFunction = 'Member';
        if (invitation.contributorRoleId) {
          const role = await ContributorRole.findById(invitation.contributorRoleId);
          if (role?.name) teamFunction = role.name;
        }

        await ProjectMember.create({
          projectId: invitation.projectId,
          userId: req.user.id,
          projectRole: 'member',
          contributorRoleId: invitation.contributorRoleId || null,
          teamFunction,
          status: 'active',
          joinedAt: new Date(),
        });
      }
    }

    res.json({ invitation });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId/invitations
 * List all invitations for a project (pending, accepted, rejected).
 */
export async function listProjectInvitations(req, res, next) {
  try {
    const { projectId } = req.params;
    const filter = { projectId };
    if (req.query.status) {
      filter.status = req.query.status;
    }

    const invitations = await Invitation.find(filter)
      .populate('invitedUser', 'name username email avatar')
      .populate('invitedBy', 'name username')
      .populate('contributorRoleId', 'name imageUrl description')
      .sort({ createdAt: -1 });

    res.json({ invitations });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/invitations/:invitationId
 * Cancel a pending invitation.
 */
export async function cancelInvitation(req, res, next) {
  try {
    const { projectId, invitationId } = req.params;

    const invitation = await Invitation.findOne({
      _id: invitationId,
      projectId,
      status: 'pending',
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Pending invitation not found' });
    }

    await Invitation.findByIdAndDelete(invitation._id);
    res.json({ ok: true, cancelledId: invitation._id });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/invitations/:invitationId/resend
 * Resend a pending invitation.
 */
export async function resendInvitation(req, res, next) {
  try {
    const { projectId, invitationId } = req.params;

    const invitation = await Invitation.findOne({
      _id: invitationId,
      projectId,
      status: 'pending',
    })
      .populate('invitedUser', 'name username email avatar')
      .populate('contributorRoleId', 'name imageUrl description');

    if (!invitation) {
      return res.status(404).json({ error: 'Pending invitation not found' });
    }

    // Refresh timestamp
    invitation.updatedAt = new Date();
    await invitation.save();

    res.json({ ok: true, invitation });
  } catch (err) {
    next(err);
  }
}
