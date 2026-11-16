import jwt from 'jsonwebtoken';

/**
 * Cookie configuration for the session token.
 * @type {import('express').CookieOptions}
 */
export const cookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
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
