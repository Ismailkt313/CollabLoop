import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} Document
 * @property {ObjectId} projectId   - Project this document belongs to
 * @property {ObjectId} uploadedBy  - User who created / uploaded the document
 * @property {string}   title       - Document title
 * @property {string}   [content]   - Raw text / markdown content
 * @property {string}   [html]      - Rendered HTML content
 * @property {string}   [format]    - Content format (markdown, html, pdf, …)
 * @property {string}   [fileUrl]   - URL of the uploaded file (if any)
 * @property {string}   [publicId]  - Cloud-storage public ID
 */
const documentSchema = new Schema(
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
      required: true,
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
    content: {
      type: String,
    },
    html: {
      type: String,
    },
    format: {
      type: String,
      default: 'markdown',
    },
    fileUrl: {
      type: String,
    },
    publicId: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  { timestamps: true }
);

/** Latest documents first within a project and role */
documentSchema.index({ projectId: 1, createdAt: -1 });
documentSchema.index({ projectId: 1, roleId: 1, createdAt: -1 });

const Document = model('Document', documentSchema);

export default Document;
