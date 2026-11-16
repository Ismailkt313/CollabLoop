import { Project, ProjectMember, Channel } from '../models/index.js';

/** Default channels created with every new project. */
const DEFAULT_CHANNELS = ['general', 'backend', 'frontend', 'design', 'qa-testing'];

/**
 * GET /projects
 * List all projects the authenticated user belongs to.
 */
export async function listProjects(req, res) {
  const memberships = await ProjectMember.find({
    userId: req.user.id,
    status: 'active',
  }).populate('projectId');

  const projects = memberships
    .filter((m) => m.projectId)
    .map((m) => ({
      ...m.projectId.toObject(),
      projectRole: m.projectRole,
      teamFunction: m.teamFunction,
    }));

  res.json({ projects });
}

/**
 * POST /projects
 * Create a new project, add the creator as owner, and seed default channels.
 */
export async function createProject(req, res, next) {
  try {
    if (!req.body.name?.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const project = await Project.create({
      name: req.body.name.trim(),
      description: req.body.description || '',
      category: req.body.category || 'General',
      thumbnail: req.body.thumbnail || '',
      ownerId: req.user.id,
    });

    await ProjectMember.create({
      projectId: project.id,
      userId: req.user.id,
      projectRole: 'owner',
      status: 'active',
      joinedAt: new Date(),
    });

    for (const name of DEFAULT_CHANNELS) {
      await Channel.create({
        projectId: project.id,
        name,
        createdBy: req.user.id,
      });
    }

    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId
 * Return a single project and the requester's membership.
 */
export async function getProject(req, res) {
  const project = await Project.findById(req.params.projectId);
  res.json({ project, membership: req.membership });
}
