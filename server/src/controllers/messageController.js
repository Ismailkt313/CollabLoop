import { Channel, Message } from '../models/index.js';

/**
 * GET /projects/:projectId/messages?channelId=…
 * List the latest 100 messages in a channel (newest first).
 */
export async function listMessages(req, res) {
  const channelExists = await Channel.exists({
    _id: req.query.channelId,
    projectId: req.params.projectId,
  });

  if (!channelExists) {
    return res.status(404).json({ error: 'Channel not found' });
  }

  const messages = await Message.find({
    projectId: req.params.projectId,
    channelId: req.query.channelId,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('senderId', 'name username avatar');

  res.json({ messages });
}
