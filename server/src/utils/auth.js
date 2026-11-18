import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Cookie configuration for the session token.
 * @type {import('express').CookieOptions}
 */
export const cookieOptions = {
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: config.cookieSameSite,
  path: '/',
  maxAge: 7 * 864e5, // 7 days
};

/**
 * Strip a Mongoose user document down to safe, public fields.
 * @param {import('mongoose').Document} user
 * @returns {{ id: string, name: string, username: string, email: string, avatar: string }}
 */
export const safeUser = (user) => ({
  id: user.id,
  name: user.name,
  username: user.username,
  email: user.email,
  avatar: user.avatar,
});

/**
 * Create a signed JWT for the given user ID.
 * @param {string} userId
 * @returns {string} Signed JWT valid for 7 days.
 */
export const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

/**
 * Create a SHA-256 hex digest of a password.
 * @param {string} password
 * @returns {string}
 */
export const passwordDigest = (password) =>
  crypto.createHash('sha256').update(password, 'utf8').digest('hex');

/**
 * Hash a password using SHA-256 pre-hashing and bcrypt (12 rounds).
 * @param {string} password
 * @returns {Promise<string>}
 */
export const hashPassword = (password) =>
  bcrypt.hash(passwordDigest(password), 12);

/**
 * Compare an incoming password with the user's stored passwordHash,
 * supporting both 'sha256-bcrypt' and 'legacy' bcrypt schemes.
 * @param {import('mongoose').Document} user
 * @param {string} password
 * @returns {Promise<boolean>}
 */
export const passwordMatches = (user, password) =>
  bcrypt.compare(
    user.passwordScheme === 'sha256-bcrypt' ? passwordDigest(password) : password,
    user.passwordHash
  );
