import { ProjectMember, Project, ContributorRole } from '../models/index.js';
import { getIO } from '../sockets/handlers.js';

/**
 * GET /projects/:projectId/members
 * List all active members of a project with identity and contributor role.
 */
export async function listMembers(req, res, next) {
  try {
    const members = await ProjectMember.find({
      projectId: req.params.projectId,
      status: 'active',
    })
      .populate('userId', 'name username email avatar')
      .populate('contributorRoleId', 'name description imageUrl cloudinaryPublicId')
      .sort({ projectRole: 1, createdAt: 1 });

    res.json({ members });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /projects/:projectId/members/:memberId
 * Update a member's project permission (Owner/Admin/Member) or contributor function.
 */
export async function updateMember(req, res, next) {
  try {
    const { projectId, memberId } = req.params;
    const { projectRole, contributorRoleId, teamFunction, previousOwnerRole } = req.body;

    const targetMember = await ProjectMember.findOne({
      _id: memberId,
      projectId,
      status: 'active',
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'Project member not found' });
    }

    const requesterRole = req.membership.projectRole;
    const isOwner = requesterRole === 'owner';
    const isSelf = String(targetMember.userId) === String(req.user.id);

    // ── 1. Permission Role Changes ──────────────────────────────────────────
    if (projectRole && projectRole !== targetMember.projectRole) {
      if (!['owner', 'admin', 'member'].includes(projectRole)) {
        return res.status(400).json({ error: 'Invalid project role specified' });
      }

      // Self-modification of permissions is forbidden
      if (isSelf) {
        return res.status(403).json({ error: 'You cannot modify your own permission role' });
      }

      // Transfer of ownership
      if (projectRole === 'owner') {
        if (!isOwner) {
          return res.status(403).json({ error: 'Only the current project owner can transfer ownership' });
        }

        // 1. Promote target member to owner
        targetMember.projectRole = 'owner';
        await targetMember.save();

        // 2. Demote current owner to specified role (default 'admin')
        const newPrevRole = ['admin', 'member'].includes(previousOwnerRole) ? previousOwnerRole : 'admin';
        req.membership.projectRole = newPrevRole;
        await req.membership.save();

        // 3. Update project.ownerId
        await Project.findByIdAndUpdate(projectId, { ownerId: targetMember.userId });
      } else {
        // Changing to admin or member
        if (!isOwner) {
          return res.status(403).json({ error: 'Only the project owner can change permission roles' });
        }

        // Target cannot be current owner without explicit transfer
        if (targetMember.projectRole === 'owner') {
          return res.status(400).json({ error: 'Cannot demote the owner directly; transfer ownership instead' });
        }

        targetMember.projectRole = projectRole;
        await targetMember.save();
      }
    }

    // ── 2. Contributor Function / Role Changes ──────────────────────────────
    if (contributorRoleId !== undefined) {
      if (contributorRoleId) {
        const role = await ContributorRole.findById(contributorRoleId);
        if (!role) {
          return res.status(400).json({ error: 'Selected contributor role does not exist' });
        }
        targetMember.contributorRoleId = role._id;
        targetMember.teamFunction = role.name;
      } else {
        targetMember.contributorRoleId = null;
        targetMember.teamFunction = String(teamFunction || 'Member').trim();
      }
      await targetMember.save();
    } else if (teamFunction !== undefined) {
      targetMember.teamFunction = String(teamFunction).trim() || 'Member';
      await targetMember.save();
    }

    const updated = await ProjectMember.findById(targetMember._id)
      .populate('userId', 'name username email avatar')
      .populate('contributorRoleId', 'name description imageUrl cloudinaryPublicId');

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('member:updated', {
        projectId,
        member: updated,
        actorId: req.user.id,
      });
      io.to(`user:${targetMember.userId}`).emit('member:updated', {
        projectId,
        member: updated,
        actorId: req.user.id,
      });
    }

    res.json({ member: updated });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/members/:memberId
 * Remove a member from the project and revoke project access.
 */
export async function removeMember(req, res, next) {
  try {
    const { projectId, memberId } = req.params;

    const targetMember = await ProjectMember.findOne({
      _id: memberId,
      projectId,
      status: 'active',
    });

    if (!targetMember) {
      return res.status(404).json({ error: 'Project member not found' });
    }

    // Owner cannot be removed
    if (targetMember.projectRole === 'owner') {
      return res.status(400).json({
        error: 'Project owner cannot be removed. Transfer ownership to another member first.',
      });
    }

    // Admins cannot remove other Admins
    const requesterRole = req.membership.projectRole;
    if (requesterRole !== 'owner' && targetMember.projectRole === 'admin') {
      return res.status(403).json({ error: 'Only the project owner can remove administrators' });
    }

    // Cannot remove self via this endpoint
    if (String(targetMember.userId) === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot remove yourself using this action' });
    }

    await ProjectMember.findByIdAndDelete(targetMember._id);

    // Socket.IO revocation and real-time updates
    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('member:removed', {
        projectId,
        memberId: targetMember._id,
        userId: targetMember.userId,
        actorId: req.user.id,
      });

      io.to(`user:${targetMember.userId}`).emit('member:removed', {
        projectId,
        memberId: targetMember._id,
        userId: targetMember.userId,
        actorId: req.user.id,
      });

      // Eject target user's active sockets from project room
      const userSockets = await io.in(`user:${targetMember.userId}`).fetchSockets();
      for (const s of userSockets) {
        s.leave(`project:${projectId}`);
      }
    }

    res.json({ ok: true, removedId: targetMember._id });
  } catch (err) {
    next(err);
  }
}
