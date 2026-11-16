import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} Invitation
 * @property {ObjectId} projectId   - The project the invitation is for
 * @property {ObjectId} invitedBy   - User who sent the invitation
 * @property {ObjectId} invitedUser - User who received the invitation
 * @property {string}   status      - Invitation state: pending | accepted | rejected
 * @property {Date}     [respondedAt] - When the invitee responded
 */
const invitationSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    invitedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    invitedUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    respondedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/** Fast lookup: pending invitations for a user within a project */
invitationSchema.index({ projectId: 1, invitedUser: 1, status: 1 });

const Invitation = model('Invitation', invitationSchema);

export default Invitation;
