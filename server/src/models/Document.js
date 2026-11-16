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
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
    },
    html: {
      type: String,
    },
    format: {
      type: String,
    },
    fileUrl: {
      type: String,
    },
    publicId: {
      type: String,
    },
  },
  { timestamps: true }
);

const Document = model('Document', documentSchema);

export default Document;
