import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} Message
 * @property {ObjectId}   projectId   - Project the message belongs to
 * @property {ObjectId}   channelId   - Channel the message was sent in
 * @property {ObjectId}   senderId    - User who sent the message
 * @property {string}     text        - Message body (max 10 000 chars)
 * @property {Array}      attachments - Mixed-type attachment payloads
 * @property {ObjectId[]} mentions    - Users mentioned in the message
 * @property {ObjectId}   [replyTo]   - Parent message for threaded replies
 * @property {string}     messageType - e.g. "text", "system", "file"
 */
const messageSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    channelId: {
      type: Schema.Types.ObjectId,
      ref: 'Channel',
      required: true,
      index: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      default: '',
      maxlength: 10000,
    },
    attachments: [Schema.Types.Mixed],
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
    },
    messageType: {
      type: String,
      default: 'text', // 'text' | 'voice' | 'file' | 'system'
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    readBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

/** Chronological and reverse message retrieval per channel */
messageSchema.index({ projectId: 1, channelId: 1, createdAt: 1 });
messageSchema.index({ projectId: 1, channelId: 1, createdAt: -1 });

const Message = model('Message', messageSchema);

export default Message;
