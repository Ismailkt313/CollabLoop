import { Channel, Message, ProjectMember } from '../models/index.js';
import { getIO } from '../sockets/handlers.js';

const DEFAULT_INITIAL_CHANNELS = [
  { name: 'general', description: 'General team discussion and questions', isDefault: true },
  { name: 'backend-help', description: 'Ask doubts to Backend and API team', isDefault: false },
  { name: 'frontend', description: 'Frontend development discussions and reviews', isDefault: false },
  { name: 'design-feedback', description: 'UI, UX and design reviews', isDefault: false },
  { name: 'docs-feedback', description: 'PRD, documentation and architecture review', isDefault: false },
  { name: 'qa-testing', description: 'Testing, bugs, and release discussions', isDefault: false },
];

/**
 * Ensure default channels exist for a project.
 */
async function ensureDefaultChannels(projectId, createdBy) {
  const existingCount = await Channel.countDocuments({ projectId });
  if (existingCount === 0) {
    const toInsert = DEFAULT_INITIAL_CHANNELS.map((ch) => ({
      ...ch,
      projectId,
      createdBy,
    }));
    await Channel.insertMany(toInsert);
  } else {
    // Ensure at least #general exists and is marked isDefault
    const generalChannel = await Channel.findOne({ projectId, name: 'general' });
    if (!generalChannel) {
      await Channel.create({
        projectId,
        name: 'general',
        description: 'General team discussion and questions',
        createdBy,
        isDefault: true,
      });
    } else if (!generalChannel.isDefault) {
      generalChannel.isDefault = true;
      await generalChannel.save();
    }
  }
}

/**
 * GET /projects/:projectId/channels
 * List all channels in a project with unread counts for current user.
 */
export async function listChannels(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Auto-seed defaults if missing
    await ensureDefaultChannels(projectId, userId);

    const channels = await Channel.find({ projectId }).sort({ isDefault: -1, createdAt: 1 });

    // Compute unread message counts per channel for this user
    const channelsWithUnread = await Promise.all(
      channels.map(async (ch) => {
        const unreadCount = await Message.countDocuments({
          projectId,
          channelId: ch._id,
          isDeleted: { $ne: true },
          senderId: { $ne: userId },
          'readBy.user': { $ne: userId },
        });

        return {
          ...ch.toObject(),
          unreadCount,
        };
      })
    );

    res.json({ channels: channelsWithUnread });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/channels
 * Create a new channel in a project.
 */
export async function createChannel(req, res, next) {
  try {
    const { projectId } = req.params;
    const rawName = String(req.body.name || '').replace(/^#/, '').toLowerCase().trim();
    const name = rawName.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const description = String(req.body.description || '').trim();
    const roleId = req.body.roleId || null;

    if (!name || name.length < 2 || name.length > 40) {
      return res.status(400).json({ error: 'Channel name must be 2–40 alphanumeric characters, hyphens or underscores' });
    }

    const existing = await Channel.findOne({ projectId, name });
    if (existing) {
      return res.status(409).json({ error: `Channel #${name} already exists in this project` });
    }

    const channel = await Channel.create({
      projectId,
      name,
      description,
      roleId,
      createdBy: req.user.id,
      isDefault: false,
    });

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('channel:created', channel);
    }

    res.status(201).json({ channel });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /projects/:projectId/channels/:channelId
 * Update channel name or description (Owner/Admin only).
 */
export async function updateChannel(req, res, next) {
  try {
    const { projectId, channelId } = req.params;

    const channel = await Channel.findOne({ _id: channelId, projectId });
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (req.body.name) {
      const rawName = String(req.body.name).replace(/^#/, '').toLowerCase().trim();
      const newName = rawName.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');

      if (channel.isDefault && newName !== 'general') {
        return res.status(400).json({ error: 'The default general channel cannot be renamed' });
      }

      if (newName !== channel.name) {
        const existing = await Channel.findOne({ projectId, name: newName });
        if (existing) {
          return res.status(409).json({ error: `Channel #${newName} already exists in this project` });
        }
        channel.name = newName;
      }
    }

    if (req.body.description !== undefined) {
      channel.description = String(req.body.description).trim();
    }

    if (req.body.roleId !== undefined) {
      channel.roleId = req.body.roleId || null;
    }

    await channel.save();

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('channel:updated', channel);
    }

    res.json({ channel });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/channels/:channelId
 * Delete a channel and its messages (Owner/Admin only, cannot delete #general).
 */
export async function deleteChannel(req, res, next) {
  try {
    const { projectId, channelId } = req.params;

    const channel = await Channel.findOne({ _id: channelId, projectId });
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.isDefault || channel.name === 'general') {
      return res.status(400).json({ error: 'The default #general channel cannot be deleted' });
    }

    await Promise.all([
      Channel.deleteOne({ _id: channelId }),
      Message.deleteMany({ channelId }),
    ]);

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}`).emit('channel:deleted', { channelId });
    }

    res.json({ ok: true, deletedChannelId: channelId });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/channels/:channelId/read
 * Mark all messages in a channel as read by the current user.
 */
export async function markChannelAsRead(req, res, next) {
  try {
    const { projectId, channelId } = req.params;
    const userId = req.user.id;

    await Message.updateMany(
      {
        projectId,
        channelId,
        'readBy.user': { $ne: userId },
      },
      {
        $push: { readBy: { user: userId, readAt: new Date() } },
      }
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /projects/:projectId/unread-summary
 * Get total unread messages count across all project channels.
 */
export async function getUnreadSummary(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const totalUnread = await Message.countDocuments({
      projectId,
      isDeleted: { $ne: true },
      senderId: { $ne: userId },
      'readBy.user': { $ne: userId },
    });

    res.json({ totalUnread });
  } catch (err) {
    next(err);
  }
}
