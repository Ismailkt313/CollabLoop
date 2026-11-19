import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} Resource
 * @property {ObjectId} projectId    - Project this resource belongs to
 * @property {ObjectId} uploadedBy   - User who uploaded the resource
 * @property {string}   [title]      - Human-readable title
 * @property {string}   [fileName]   - Original file name
 * @property {string}   fileUrl      - URL where the file is stored
 * @property {string}   [publicId]   - Cloud-storage public ID (e.g. Cloudinary)
 * @property {string}   [resourceType] - MIME category (image, video, raw, …)
 * @property {string}   [category]   - Organisational category
 * @property {number}   [fileSize]   - Size in bytes
 */
const resourceSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    roleId: {
      type: Schema.Types.ObjectId,
      ref: 'ContributorRole',
      index: true,
      default: null,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    fileName: {
      type: String,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
    },
    resourceType: {
      type: String,
      default: 'image',
    },
    format: {
      type: String,
    },
    category: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    width: {
      type: Number,
    },
    height: {
      type: Number,
    },
    duration: {
      type: Number,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual aliases
resourceSchema.virtual('secureUrl')
  .get(function () { return this.fileUrl; })
  .set(function (v) { this.fileUrl = v; });

resourceSchema.virtual('cloudinaryPublicId')
  .get(function () { return this.publicId; })
  .set(function (v) { this.publicId = v; });

/** Latest resources first within a project and role */
resourceSchema.index({ projectId: 1, createdAt: -1 });
resourceSchema.index({ projectId: 1, roleId: 1, createdAt: -1 });

const Resource = model('Resource', resourceSchema);

export default Resource;
