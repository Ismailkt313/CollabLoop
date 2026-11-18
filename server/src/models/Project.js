import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} Project
 * @property {string}   name        - Project title (max 100 chars)
 * @property {string}   description - Optional project description
 * @property {string}   [thumbnail] - URL to a thumbnail image
 * @property {ObjectId} ownerId     - Reference to the User who owns this project
 * @property {string}   category    - Project category label
 */
const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      default: '',
    },
    thumbnail: {
      type: String,
    },
    thumbnailPublicId: {
      type: String,
      default: '',
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      default: 'General',
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Project = model('Project', projectSchema);

export default Project;
