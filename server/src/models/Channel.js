import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} Channel
 * @property {ObjectId} projectId   - The project this channel belongs to
 * @property {string}   name        - Channel name (unique within a project)
 * @property {string}   [description] - Optional channel description
 * @property {ObjectId} createdBy   - User who created the channel
 */
const channelSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'ContributorRole',
    },
  },
  { timestamps: true }
);

/** Channel names must be unique within a project */
channelSchema.index({ projectId: 1, name: 1 }, { unique: true });

const Channel = model('Channel', channelSchema);

export default Channel;
