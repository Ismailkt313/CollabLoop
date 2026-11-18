import mongoose from 'mongoose';
import {
  Project,
  ProjectMember,
  Channel,
  Invitation,
  User,
  ContributorRole,
  Resource,
  Document,
  Message,
} from '../models/index.js';
import { destroyCloudinaryAsset } from './uploadController.js';
import { getIO } from '../sockets/handlers.js';

/** Default channels created with every new project. */
const DEFAULT_CHANNELS = ['general', 'backend', 'frontend', 'design', 'qa-testing'];

/**
 * GET /projects
 * List all projects the authenticated user belongs to.
 */
export async function listProjects(req, res) {
  const isArchived = req.query.archived === 'true';
  const memberships = await ProjectMember.find({
    userId: req.user.id,
    status: 'active',
  }).populate('projectId');

  const projects = memberships
    .filter((m) => m.projectId && Boolean(m.projectId.isArchived) === isArchived)
    .map((m) => ({
      ...m.projectId.toObject(),
      projectRole: m.projectRole,
      teamFunction: m.teamFunction,
    }));

  res.json({ projects });
}

/**
 * POST /projects
 * Create a new project, add the creator as owner, seed default channels,
 * and create invitations for selected contributors.
 */
export async function createProject(req, res, next) {
  try {
    const rawName = String(req.body.name || '').trim();
    if (!rawName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    if (rawName.length > 100) {
      return res.status(400).json({ error: 'Project name cannot exceed 100 characters' });
    }

    const rawContributors = Array.isArray(req.body.contributors) ? req.body.contributors : [];
    const validatedContributors = [];
    const seenUserIds = new Set();

    // Validate contributors before creating project
    for (const [index, item] of rawContributors.entries()) {
      const userId = String(item.userId || item._id || '').trim();
      const contributorRoleId = String(item.contributorRoleId || item.roleId || '').trim();

      if (!userId) {
        return res.status(400).json({ error: `Contributor #${index + 1} has no valid user selected` });
      }

      if (userId === req.user.id.toString()) {
        return res.status(400).json({ error: 'You cannot invite yourself as a contributor' });
      }

      if (seenUserIds.has(userId)) {
        return res.status(400).json({ error: 'Duplicate contributors are not allowed in the same project' });
      }
      seenUserIds.add(userId);

      if (!contributorRoleId) {
        return res.status(400).json({ error: `Contributor #${index + 1} must have an assigned role` });
      }

      // Check user exists
      const targetUser = await User.findById(userId).select('_id username name email');
      if (!targetUser) {
        return res.status(400).json({ error: `Selected user for contributor #${index + 1} was not found` });
      }

      // Check role exists
      const targetRole = await ContributorRole.findById(contributorRoleId).select('_id name');
      if (!targetRole) {
        return res.status(400).json({ error: `Assigned role for contributor #${index + 1} was not found` });
      }

      validatedContributors.push({
        user: targetUser,
        role: targetRole,
      });
    }

    // 1. Create project
    const project = await Project.create({
      name: rawName,
      description: String(req.body.description || '').trim(),
      category: String(req.body.category || 'General').trim() || 'General',
      thumbnail: String(req.body.thumbnail || '').trim(),
      ownerId: req.user.id,
    });

    // 2. Add creator as Project Owner
    await ProjectMember.create({
      projectId: project.id,
      userId: req.user.id,
      projectRole: 'owner',
      teamFunction: 'Project Owner',
      status: 'active',
      joinedAt: new Date(),
    });

    // 3. Seed default project channels
    for (const name of DEFAULT_CHANNELS) {
      await Channel.create({
        projectId: project.id,
        name,
        createdBy: req.user.id,
        isDefault: name === 'general',
      });
    }

    // 4. Create pending invitations for contributors
    const invitations = [];
    const invitationErrors = [];

    for (const contributor of validatedContributors) {
      try {
        const inv = await Invitation.create({
          projectId: project.id,
          invitedBy: req.user.id,
          invitedUser: contributor.user._id,
          contributorRoleId: contributor.role._id,
          status: 'pending',
        });
        invitations.push(inv);
      } catch (invErr) {
        invitationErrors.push({
          userId: contributor.user._id,
          username: contributor.user.username,
          error: invErr.message,
        });
      }
    }

    res.status(201).json({
      project: {
        ...project.toObject(),
        projectRole: 'owner',
        teamFunction: 'Project Owner',
      },
      invitationsSent: invitations.length,
      invitationErrors: invitationErrors.length > 0 ? invitationErrors : undefined,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId
 * Return a single project and the requester's membership.
 */
export async function getProject(req, res) {
  const project = await Project.findById(req.params.projectId).populate('ownerId', 'name username email avatar');
  res.json({ project, membership: req.membership });
}

/**
 * GET /projects/:projectId/workspaces
 * Return the project detail landing page data:
 * - Project details and populated owner
 * - Requester's membership
 * - Dynamic project-specific roles with assigned active contributors and pending invitations
 * - Aggregate resource/document/channel counts
 */
export async function getProjectWorkspaces(req, res, next) {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId).populate('ownerId', 'name username email avatar');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // 1. Fetch active members, pending invitations, and resource/document counts
    const [members, pendingInvitations, resourceCount, documentCount, channelCount, roleResourceAgg, roleDocumentAgg] = await Promise.all([
      ProjectMember.find({ projectId, status: 'active' })
        .populate('userId', 'name username email avatar')
        .populate('contributorRoleId', 'name description imageUrl cloudinaryPublicId'),
      Invitation.find({ projectId, status: 'pending' })
        .populate('invitedUser', 'name username email avatar')
        .populate('contributorRoleId', 'name description imageUrl cloudinaryPublicId'),
      Resource.countDocuments({ projectId }),
      Document.countDocuments({ projectId }),
      Channel.countDocuments({ projectId }),
      Resource.aggregate([
        { $match: { projectId: new mongoose.Types.ObjectId(projectId), roleId: { $ne: null } } },
        { $group: { _id: '$roleId', count: { $sum: 1 } } },
      ]),
      Document.aggregate([
        { $match: { projectId: new mongoose.Types.ObjectId(projectId), roleId: { $ne: null } } },
        { $group: { _id: '$roleId', count: { $sum: 1 } } },
      ]),
    ]);

    const resourceCountMap = new Map();
    roleResourceAgg.forEach((r) => resourceCountMap.set(String(r._id), r.count));

    const documentCountMap = new Map();
    roleDocumentAgg.forEach((d) => documentCountMap.set(String(d._id), d.count));

    // 2. Group roles that are actually configured/assigned in this project
    const roleMap = new Map();

    const getOrCreateRoleGroup = (roleId, roleDoc, fallbackName) => {
      const key = String(roleId || fallbackName).trim().toLowerCase();
      if (!roleMap.has(key)) {
        roleMap.set(key, {
          _id: roleDoc?._id || roleId || key,
          name: roleDoc?.name || fallbackName || 'Contributor',
          description: roleDoc?.description || '',
          imageUrl: roleDoc?.imageUrl || '',
          cloudinaryPublicId: roleDoc?.cloudinaryPublicId || '',
          contributors: [],
          pendingInvitations: [],
        });
      }
      return roleMap.get(key);
    };

    // Add active members to their corresponding role group
    for (const member of members) {
      if (member.contributorRoleId) {
        const group = getOrCreateRoleGroup(
          member.contributorRoleId._id,
          member.contributorRoleId,
          member.contributorRoleId.name
        );
        group.contributors.push({
          _id: member._id,
          user: member.userId,
          projectRole: member.projectRole,
          teamFunction: member.teamFunction || member.contributorRoleId.name,
          joinedAt: member.joinedAt || member.createdAt,
        });
      } else if (member.teamFunction && member.teamFunction !== 'Project Owner' && member.teamFunction !== 'Other') {
        // Find if a ContributorRole exists for this teamFunction
        const existingRole = await ContributorRole.findOne({ normalizedName: member.teamFunction.toLowerCase().trim() });
        const group = getOrCreateRoleGroup(
          existingRole?._id || member.teamFunction,
          existingRole,
          member.teamFunction
        );
        group.contributors.push({
          _id: member._id,
          user: member.userId,
          projectRole: member.projectRole,
          teamFunction: member.teamFunction,
          joinedAt: member.joinedAt || member.createdAt,
        });
      }
    }

    // Add pending invitations to their corresponding role group
    for (const inv of pendingInvitations) {
      if (inv.contributorRoleId) {
        const group = getOrCreateRoleGroup(
          inv.contributorRoleId._id,
          inv.contributorRoleId,
          inv.contributorRoleId.name
        );
        group.pendingInvitations.push({
          _id: inv._id,
          user: inv.invitedUser,
          status: 'pending',
          createdAt: inv.createdAt,
        });
      }
    }

    // Convert map to array and compute counts
    const configuredRoles = Array.from(roleMap.values()).map((role) => {
      const rId = String(role._id);
      return {
        ...role,
        activeCount: role.contributors.length,
        pendingCount: role.pendingInvitations.length,
        resourceCount: resourceCountMap.get(rId) || 0,
        documentCount: documentCountMap.get(rId) || 0,
        channelCount: channelCount,
      };
    });

    // Sort alphabetically by role name
    configuredRoles.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      project,
      membership: req.membership,
      stats: {
        totalMembers: members.length,
        totalRoles: configuredRoles.length,
        totalResources: resourceCount,
        totalDocuments: documentCount,
        totalChannels: channelCount,
      },
      roles: configuredRoles,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId/workspaces/:roleId
 * Return detailed workspace data for a specific role inside the project:
 * - Role metadata
 * - Contributors assigned to this role
 * - Pending invitations for this role
 * - Project channels, documents, and resources
 */
export async function getRoleWorkspace(req, res, next) {
  try {
    const { projectId, roleId } = req.params;

    const project = await Project.findById(projectId).populate('ownerId', 'name username email avatar');
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Lookup role definition
    let role = null;
    if (roleId.match(/^[0-9a-fA-F]{24}$/)) {
      role = await ContributorRole.findById(roleId);
    }
    if (!role) {
      // Try lookup by normalizedName
      role = await ContributorRole.findOne({ normalizedName: roleId.toLowerCase().trim() });
    }

    // Query active members for this role in this project
    const memberFilter = { projectId, status: 'active' };
    if (role) {
      memberFilter.$or = [
        { contributorRoleId: role._id },
        { teamFunction: role.name },
      ];
    }

    // Query resources and documents specific to this role
    const resourceFilter = { projectId };
    const documentFilter = { projectId };
    if (role) {
      resourceFilter.roleId = role._id;
      documentFilter.roleId = role._id;
    }

    const [members, pendingInvitations, channels, documents, resources] = await Promise.all([
      ProjectMember.find(memberFilter).populate('userId', 'name username email avatar'),
      role
        ? Invitation.find({ projectId, contributorRoleId: role._id, status: 'pending' }).populate('invitedUser', 'name username email avatar')
        : [],
      Channel.find({ projectId }).sort({ name: 1 }),
      Document.find(documentFilter).populate('uploadedBy', 'name username avatar').sort({ createdAt: -1 }),
      Resource.find(resourceFilter).populate('uploadedBy', 'name username avatar').sort({ createdAt: -1 }),
    ]);

    res.json({
      project,
      membership: req.membership,
      role: role || { _id: roleId, name: roleId, description: '', imageUrl: '' },
      contributors: members.map((m) => ({
        _id: m._id,
        user: m.userId,
        projectRole: m.projectRole,
        teamFunction: m.teamFunction || role?.name || 'Member',
        joinedAt: m.joinedAt || m.createdAt,
      })),
      pendingInvitations: pendingInvitations.map((inv) => ({
        _id: inv._id,
        user: inv.invitedUser,
        status: 'pending',
        createdAt: inv.createdAt,
      })),
      channels,
      documents,
      resources,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId/settings
 * Return general project settings and summary statistics for management views.
 */
export async function getProjectSettings(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId).populate('ownerId', 'name username email avatar');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const [memberCount, invitationCount, resourceCount, documentCount, channelCount] = await Promise.all([
      ProjectMember.countDocuments({ projectId, status: 'active' }),
      Invitation.countDocuments({ projectId, status: 'pending' }),
      Resource.countDocuments({ projectId }),
      Document.countDocuments({ projectId }),
      Channel.countDocuments({ projectId }),
    ]);

    res.json({
      project,
      membership: req.membership,
      stats: {
        totalMembers: memberCount,
        pendingInvitations: invitationCount,
        totalResources: resourceCount,
        totalDocuments: documentCount,
        totalChannels: channelCount,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /projects/:projectId
 * Update general project details (name, description, category, thumbnail).
 * Allowed for Owner and Admins.
 */
export async function updateProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (req.body.name !== undefined) {
      const trimmedName = String(req.body.name).trim();
      if (!trimmedName) {
        return res.status(400).json({ error: 'Project name is required' });
      }
      if (trimmedName.length > 100) {
        return res.status(400).json({ error: 'Project name cannot exceed 100 characters' });
      }
      project.name = trimmedName;
    }

    if (req.body.description !== undefined) {
      project.description = String(req.body.description).trim();
    }

    if (req.body.category !== undefined) {
      project.category = String(req.body.category).trim() || 'General';
    }

    // Thumbnail replace or remove
    if (req.body.thumbnail !== undefined) {
      const newThumbnail = String(req.body.thumbnail || '').trim();
      const newPublicId = String(req.body.thumbnailPublicId || '').trim();

      // If replacing or removing an existing thumbnail, destroy the old Cloudinary asset
      if (project.thumbnailPublicId && project.thumbnailPublicId !== newPublicId) {
        await destroyCloudinaryAsset(project.thumbnailPublicId, 'image').catch(() => {});
      }

      project.thumbnail = newThumbnail;
      project.thumbnailPublicId = newPublicId;
    }

    await project.save();
    await project.populate('ownerId', 'name username email avatar');

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('project:updated', { project });
    }

    res.json({ project });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/archive
 * Archive project (Owner only).
 */
export async function archiveProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.isArchived = true;
    project.archivedAt = new Date();
    await project.save();

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('project:archived', { projectId });
    }

    res.json({ ok: true, project });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/unarchive
 * Restore an archived project (Owner only).
 */
export async function unarchiveProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    project.isArchived = false;
    project.archivedAt = null;
    await project.save();

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('project:unarchived', { projectId });
    }

    res.json({ ok: true, project });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId
 * Safely and permanently delete a project and all associated project data (Owner only).
 * Requires exact project name confirmation in request body.
 */
export async function deleteProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const { confirmName } = req.body;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (confirmName !== project.name) {
      return res.status(400).json({
        error: `Confirmation failed. Please type "${project.name}" exactly to confirm deletion.`,
      });
    }

    // 1. Destroy Cloudinary assets belonging exclusively to this project
    const [resources, documents] = await Promise.all([
      Resource.find({ projectId, publicId: { $exists: true, $ne: '' } }),
      Document.find({ projectId, publicId: { $exists: true, $ne: '' } }),
    ]);

    for (const resItem of resources) {
      if (resItem.publicId) {
        await destroyCloudinaryAsset(resItem.publicId, resItem.resourceType || 'image').catch(() => {});
      }
    }

    for (const docItem of documents) {
      if (docItem.publicId) {
        const cType = docItem.format === 'pdf' ? 'image' : 'raw';
        await destroyCloudinaryAsset(docItem.publicId, cType).catch(() => {});
      }
    }

    if (project.thumbnailPublicId) {
      await destroyCloudinaryAsset(project.thumbnailPublicId, 'image').catch(() => {});
    }

    // 2. Cascade delete project-scoped database records
    await Promise.all([
      Resource.deleteMany({ projectId }),
      Document.deleteMany({ projectId }),
      Message.deleteMany({ projectId }),
      Channel.deleteMany({ projectId }),
      Invitation.deleteMany({ projectId }),
      ProjectMember.deleteMany({ projectId }),
    ]);

    // 3. Delete Project record itself
    await Project.findByIdAndDelete(projectId);

    // 4. Notify and disconnect any connected sockets for this project
    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('project:deleted', { projectId });
      const sockets = await io.in(`project:${projectId}`).fetchSockets();
      for (const s of sockets) {
        s.leave(`project:${projectId}`);
      }
    }

    res.json({ ok: true, deletedId: projectId });
  } catch (err) {
    next(err);
  }
}
