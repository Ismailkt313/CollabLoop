import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} ProjectMember
 * @property {ObjectId} projectId    - Reference to the parent Project
 * @property {ObjectId} userId       - Reference to the member User
 * @property {string}   projectRole  - Role within the project: owner | admin | member
 * @property {string}   teamFunction - Functional role label (e.g. Designer, Developer)
 * @property {string}   status       - Membership status: active | pending
 * @property {Date}     [joinedAt]   - When the member joined
 */
const memberSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectRole: {
      type: String,
      enum: ['owner', 'admin', 'member'],
      default: 'member',
    },
    teamFunction: {
      type: String,
      default: 'Other',
    },
    status: {
      type: String,
      enum: ['active', 'pending'],
      default: 'active',
    },
    joinedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

/** Ensure a user can only appear once per project */
memberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

const ProjectMember = model('ProjectMember', memberSchema);

export default ProjectMember;
