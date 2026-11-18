import { Channel, Message, ProjectMember } from '../models/index.js';
import { getIO } from '../sockets/handlers.js';

/**
 * GET /projects/:projectId/messages?channelId=…&limit=50&before=…
 * List paginated messages in a channel (chronological order returned to client).
 */
export async function listMessages(req, res, next) {
  try {
    const { projectId } = req.params;
    const channelId = req.query.channelId;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before;

    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }

    const channel = await Channel.findOne({ _id: channelId, projectId });
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const query = {
      projectId,
      channelId,
    };

    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const rawMessages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .populate('senderId', 'name username avatar')
      .populate('mentions', 'name username')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'name username avatar' },
      });

    const hasMore = rawMessages.length > limit;
    const messages = (hasMore ? rawMessages.slice(0, limit) : rawMessages).reverse();

    // Auto mark retrieved messages as read for this user
    Message.updateMany(
      {
        projectId,
        channelId,
        'readBy.user': { $ne: req.user.id },
      },
      {
        $push: { readBy: { user: req.user.id, readAt: new Date() } },
      }
    ).catch(() => {});

    res.json({
      messages,
      hasMore,
      channel: {
        _id: channel._id,
        name: channel.name,
        description: channel.description,
        isDefault: channel.isDefault,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /projects/:projectId/messages
 * Send a message via REST endpoint (useful for attachments/voice notes or fallback).
 */
export async function createMessage(req, res, next) {
  try {
    const { projectId } = req.params;
    const { channelId, text, attachments, mentions, replyTo, messageType } = req.body;

    if (!channelId) {
      return res.status(400).json({ error: 'channelId is required' });
    }

    const channel = await Channel.findOne({ _id: channelId, projectId });
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const cleanText = String(text || '').trim().slice(0, 10000);
    const cleanAttachments = Array.isArray(attachments) ? attachments : [];
    const cleanMentions = Array.isArray(mentions) ? mentions : [];

    if (!cleanText && cleanAttachments.length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const saved = await Message.create({
      projectId,
      channelId,
      senderId: req.user.id,
      text: cleanText,
      attachments: cleanAttachments,
      mentions: cleanMentions,
      replyTo: replyTo || null,
      messageType: messageType || (cleanAttachments.length > 0 ? 'file' : 'text'),
      readBy: [{ user: req.user.id, readAt: new Date() }],
    });

    const populated = await Message.findById(saved._id)
      .populate('senderId', 'name username avatar')
      .populate('mentions', 'name username')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'name username avatar' },
      });

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}:channel:${channelId}`).emit('message:new', populated);
      io.to(`project:${projectId}`).emit('channel:activity', {
        projectId,
        channelId,
        senderId: req.user.id,
        messageId: populated._id,
      });

      if (cleanMentions.length > 0) {
        for (const mId of cleanMentions) {
          io.to(`user:${mId}`).emit('notification:mention', {
            projectId,
            channelId,
            channelName: channel.name,
            message: populated,
          });
        }
      }
    }

    res.status(201).json({ message: populated });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /projects/:projectId/messages/:messageId
 * Edit own message text.
 */
export async function updateMessage(req, res, next) {
  try {
    const { projectId, messageId } = req.params;
    const { text } = req.body;

    const message = await Message.findOne({ _id: messageId, projectId, isDeleted: false });
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (String(message.senderId) !== String(req.user.id)) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    message.text = String(text || '').trim().slice(0, 10000);
    message.isEdited = true;
    message.editedAt = new Date();
    await message.save();

    const populated = await Message.findById(message._id)
      .populate('senderId', 'name username avatar')
      .populate('mentions', 'name username')
      .populate({
        path: 'replyTo',
        populate: { path: 'senderId', select: 'name username avatar' },
      });

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}:channel:${message.channelId}`).emit('message:updated', populated);
    }

    res.json({ message: populated });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /projects/:projectId/messages/:messageId
 * Soft delete a message (sender or Owner/Admin).
 */
export async function deleteMessage(req, res, next) {
  try {
    const { projectId, messageId } = req.params;

    const message = await Message.findOne({ _id: messageId, projectId });
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const isOwnerOrAdmin = req.membership.projectRole === 'owner' || req.membership.projectRole === 'admin';
    const isSender = String(message.senderId) === String(req.user.id);

    if (!isSender && !isOwnerOrAdmin) {
      return res.status(403).json({ error: 'Unauthorized to delete this message' });
    }

    message.isDeleted = true;
    message.text = 'This message was deleted';
    message.attachments = [];
    await message.save();

    const io = getIO();
    if (io) {
      io.to(`project:${projectId}:channel:${message.channelId}`).emit('message:deleted', {
        messageId: message._id,
        channelId: message.channelId,
      });
    }

    res.json({ ok: true, messageId: message._id });
  } catch (err) {
    next(err);
  }
}
