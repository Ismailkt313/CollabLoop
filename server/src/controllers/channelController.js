import { Channel } from '../models/index.js';

/**
 * GET /projects/:projectId/channels
 * List all channels in a project, sorted by creation date.
 */
export async function listChannels(req, res) {
  const channels = await Channel.find({
    projectId: req.params.projectId,
  }).sort('createdAt');

  res.json({ channels });
}

/**
 * POST /projects/:projectId/channels
 * Create a new channel in a project.
 */
export async function createChannel(req, res) {
  const channel = await Channel.create({
    projectId: req.params.projectId,
    name: String(req.body.name || '').replace(/^#/, '').toLowerCase(),
    description: req.body.description || '',
    createdBy: req.user.id,
  });

  res.status(201).json({ channel });
}
