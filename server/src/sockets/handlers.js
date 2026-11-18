import { Server } from 'socket.io';
import { socketAuth } from './auth.js';
import { ProjectMember, Channel, Message, User } from '../models/index.js';

let ioInstance = null;

export function getIO() {
  return ioInstance;
}

/**
 * Creates a Socket.IO server, applies authentication middleware, and
 * registers all real-time event handlers.
 *
 * @param {import('node:http').Server} httpServer - The underlying HTTP server.
 * @param {{ clientOrigin: string }} config - App configuration.
 * @returns {Server} The configured Socket.IO server instance.
 */
export function registerSocketHandlers(httpServer, config) {
  const io = new Server(httpServer, {
    cors: {
      origin: config.clientOrigin,
      credentials: true,
    },
  });

  ioInstance = io;
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const userId = socket.user.id;

    // Join personal user room for direct notifications
    socket.join(`user:${userId}`);

    /**
     * Join project-wide room after verifying active membership.
     */
    socket.on('project:join', async ({ projectId }, callback) => {
      try {
        if (!projectId) return;
        const isMember = await ProjectMember.exists({
          projectId,
          userId,
          status: 'active',
        });

        if (isMember) {
          socket.join(`project:${projectId}`);
          if (typeof callback === 'function') callback({ ok: true });
        } else {
          if (typeof callback === 'function') callback({ error: 'Not a project member' });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    /**
     * Leave project room.
     */
    socket.on('project:leave', ({ projectId }) => {
      if (projectId) {
        socket.leave(`project:${projectId}`);
      }
    });

    /**
     * Join a project channel room after verifying project membership and channel existence.
     */
    socket.on('channel:join', async ({ projectId, channelId }, callback) => {
      try {
        if (!projectId || !channelId) return;

        const [isMember, channel] = await Promise.all([
          ProjectMember.exists({ projectId, userId, status: 'active' }),
          Channel.exists({ _id: channelId, projectId }),
        ]);

        if (isMember && channel) {
          socket.join(`project:${projectId}:channel:${channelId}`);
          if (typeof callback === 'function') callback({ ok: true });
        } else {
          if (typeof callback === 'function') callback({ error: 'Access denied' });
        }
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    /**
     * Leave a project channel room.
     */
    socket.on('channel:leave', ({ projectId, channelId }) => {
      if (projectId && channelId) {
        socket.leave(`project:${projectId}:channel:${channelId}`);
      }
    });

    /**
     * Send message to channel with real-time delivery and unread notifications.
     */
    socket.on('message:send', async ({ projectId, channelId, message }, callback) => {
      try {
        if (!projectId || !channelId) {
          if (typeof callback === 'function') callback({ error: 'Invalid parameters' });
          return;
        }

        const [membership, channel] = await Promise.all([
          ProjectMember.findOne({ projectId, userId, status: 'active' }),
          Channel.findById(channelId),
        ]);

        if (!membership || !channel || String(channel.projectId) !== String(projectId)) {
          if (typeof callback === 'function') callback({ error: 'Unauthorized or channel not found' });
          return;
        }

        const text = String(message?.text || '').trim().slice(0, 10000);
        const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
        const mentions = Array.isArray(message?.mentions) ? message.mentions : [];
        const replyTo = message?.replyTo || null;
        const messageType = message?.messageType || (attachments.length > 0 ? 'file' : 'text');

        if (!text && attachments.length === 0) {
          if (typeof callback === 'function') callback({ error: 'Message cannot be empty' });
          return;
        }

        const saved = await Message.create({
          projectId,
          channelId,
          senderId: userId,
          text,
          attachments,
          mentions,
          replyTo,
          messageType,
          readBy: [{ user: userId, readAt: new Date() }],
        });

        const populated = await Message.findById(saved._id)
          .populate('senderId', 'name username avatar')
          .populate('mentions', 'name username')
          .populate({
            path: 'replyTo',
            populate: { path: 'senderId', select: 'name username avatar' },
          });

        // Broadcast to everyone in channel room
        io.to(`project:${projectId}:channel:${channelId}`).emit('message:new', populated);

        // Broadcast channel activity to project room for unread badges
        io.to(`project:${projectId}`).emit('channel:activity', {
          projectId,
          channelId,
          senderId: userId,
          messageId: populated._id,
        });

        // If mentions exist, broadcast mention notification
        if (mentions.length > 0) {
          for (const mentionedId of mentions) {
            io.to(`user:${mentionedId}`).emit('notification:mention', {
              projectId,
              channelId,
              channelName: channel.name,
              message: populated,
            });
          }
        }

        if (typeof callback === 'function') callback({ ok: true, message: populated });
      } catch (err) {
        console.error('Socket message:send error:', err);
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    /**
     * Edit own message.
     */
    socket.on('message:edit', async ({ projectId, channelId, messageId, text }, callback) => {
      try {
        const msg = await Message.findOne({ _id: messageId, projectId, channelId, isDeleted: false });
        if (!msg) {
          if (typeof callback === 'function') callback({ error: 'Message not found' });
          return;
        }

        if (String(msg.senderId) !== String(userId)) {
          if (typeof callback === 'function') callback({ error: 'You can only edit your own messages' });
          return;
        }

        msg.text = String(text || '').trim().slice(0, 10000);
        msg.isEdited = true;
        msg.editedAt = new Date();
        await msg.save();

        const populated = await Message.findById(msg._id)
          .populate('senderId', 'name username avatar')
          .populate('mentions', 'name username')
          .populate({
            path: 'replyTo',
            populate: { path: 'senderId', select: 'name username avatar' },
          });

        io.to(`project:${projectId}:channel:${channelId}`).emit('message:updated', populated);
        if (typeof callback === 'function') callback({ ok: true, message: populated });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    /**
     * Delete message (sender or Owner/Admin).
     */
    socket.on('message:delete', async ({ projectId, channelId, messageId }, callback) => {
      try {
        const [msg, member] = await Promise.all([
          Message.findOne({ _id: messageId, projectId, channelId }),
          ProjectMember.findOne({ projectId, userId, status: 'active' }),
        ]);

        if (!msg || !member) {
          if (typeof callback === 'function') callback({ error: 'Message not found' });
          return;
        }

        const isOwnerOrAdmin = member.projectRole === 'owner' || member.projectRole === 'admin';
        const isSender = String(msg.senderId) === String(userId);

        if (!isSender && !isOwnerOrAdmin) {
          if (typeof callback === 'function') callback({ error: 'Unauthorized to delete this message' });
          return;
        }

        msg.isDeleted = true;
        msg.text = 'This message was deleted';
        msg.attachments = [];
        await msg.save();

        io.to(`project:${projectId}:channel:${channelId}`).emit('message:deleted', {
          messageId,
          channelId,
        });

        if (typeof callback === 'function') callback({ ok: true, messageId });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    /**
     * Typing indicators.
     */
    socket.on('typing:start', ({ projectId, channelId, name, username }) => {
      socket.to(`project:${projectId}:channel:${channelId}`).emit('typing:user', {
        channelId,
        userId,
        name: name || username || 'A member',
        username,
      });
    });

    socket.on('typing:stop', ({ projectId, channelId }) => {
      socket.to(`project:${projectId}:channel:${channelId}`).emit('typing:user_stopped', {
        channelId,
        userId,
      });
    });

    /**
     * Mark channel messages as read by current user.
     */
    socket.on('messages:read', async ({ projectId, channelId }) => {
      try {
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

        socket.emit('unread:updated', { projectId, channelId });
      } catch (err) {
        console.warn('Socket messages:read notice:', err);
      }
    });
  });

  return io;
}
