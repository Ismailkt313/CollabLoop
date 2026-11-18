import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} ContributorRole
 * @property {string}   name               - Display name of the role (e.g. "Backend Developer")
 * @property {string}   normalizedName     - Lowercase unique key for case-insensitive lookup
 * @property {string}   description        - Responsibilities and scope of this role
 * @property {string}   [imageUrl]         - URL to the role's badge / avatar image
 * @property {string}   [cloudinaryPublicId] - Public ID for the image in Cloudinary
 * @property {ObjectId} [createdBy]        - User who defined this role (null for system seeds)
 * @property {Date}     createdAt
 * @property {Date}     updatedAt
 */
const contributorRoleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 60,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    imageUrl: {
      type: String,
      default: '',
    },
    cloudinaryPublicId: {
      type: String,
      default: '',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

const ContributorRole = model('ContributorRole', contributorRoleSchema);

export default ContributorRole;
