import mongoose from 'mongoose';

const { Schema, model } = mongoose;

/**
 * @typedef {Object} User
 * @property {string} name           - Display name of the user
 * @property {string} username       - Unique lowercase handle (3–30 chars, alphanumeric + underscore)
 * @property {string} email          - Unique email address
 * @property {string} passwordHash   - Bcrypt hash (excluded from queries by default)
 * @property {string} [avatar]       - URL to the user's avatar image
 */
const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
      match: /^[a-z0-9_]{3,30}$/,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      type: String,
    },
  },
  { timestamps: true }
);

const User = model('User', userSchema);

export default User;
