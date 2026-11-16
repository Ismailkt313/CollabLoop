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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
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
    },
    category: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
  },
  { timestamps: true }
);

/** Latest resources first within a project */
resourceSchema.index({ projectId: 1, createdAt: -1 });

const Resource = model('Resource', resourceSchema);

export default Resource;
