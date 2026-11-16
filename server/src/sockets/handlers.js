import { Server } from 'socket.io';
import { socketAuth } from './auth.js';

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

  io.use(socketAuth);

  io.on('connection', (socket) => {
    /**
     * Join a project channel room after verifying membership.
     */
    socket.on('channel:join', async ({ projectId, channelId }) => {
      const { ProjectMember } = await import('../models/index.js');

      if (
        await ProjectMember.exists({
          projectId,
          userId: socket.user.id,
          status: 'active',
        })
      ) {
        socket.join(`${projectId}:${channelId}`);
      }
    });

    /**
     * Send a message to a project channel after verifying membership and
     * channel existence.
     */
    socket.on('message:send', async ({ projectId, channelId, message }) => {
      const { ProjectMember, Channel, Message } = await import(
        '../models/index.js'
      );

      if (
        !(await ProjectMember.exists({
          projectId,
          userId: socket.user.id,
          status: 'active',
        })) ||
        !(await Channel.exists({ _id: channelId, projectId }))
      ) {
        return;
      }

      const saved = await Message.create({
        projectId,
        channelId,
        senderId: socket.user.id,
        text: String(message?.text || '').slice(0, 10000),
        replyTo: message?.replyTo || undefined,
      });

      const populated = await saved.populate('senderId', 'name username avatar');
      io.to(`${projectId}:${channelId}`).emit('message:new', populated);
    });
  });

  return io;
}
