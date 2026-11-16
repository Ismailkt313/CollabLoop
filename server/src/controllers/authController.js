import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { safeUser, cookieOptions, signToken } from '../utils/auth.js';

/**
 * POST /auth/register
 * Create a new user account and set the session cookie.
 */
export async function register(req, res, next) {
  try {
    const { name, username, email, password, confirmPassword } = req.body;

    if (!name?.trim() || !username || !email || !password) {
      return res.status(400).json({ error: 'All registration fields are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }
    if (!/^[a-z0-9_]{3,30}$/i.test(username)) {
      return res.status(400).json({ error: 'Username must be 3\u201330 letters, numbers, or underscores' });
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }

    const normalizedUsername = username.toLowerCase();

    if (await User.exists({ $or: [{ username: normalizedUsername }, { email: email.toLowerCase() }] })) {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
    });

    res
      .cookie('collabloop_session', signToken(user.id), cookieOptions)
      .status(201)
      .json({ user: safeUser(user) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }
    next(err);
  }
}

/**
 * POST /auth/login
 * Authenticate with email + password and set the session cookie.
 */
export async function login(req, res, next) {
  try {
    const user = await User.findOne({
      email: String(req.body.email || '').toLowerCase(),
    }).select('+passwordHash');

    if (!user || !(await bcrypt.compare(req.body.password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res
      .cookie('collabloop_session', signToken(user.id), cookieOptions)
      .json({ user: safeUser(user) });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/logout
 * Clear the session cookie.
 */
export function logout(_req, res) {
  res
    .clearCookie('collabloop_session', { ...cookieOptions, maxAge: undefined })
    .json({ ok: true });
}

/**
 * GET /auth/me
 * Return the currently authenticated user.
 */
export function getMe(req, res) {
  res.json({ user: safeUser(req.user) });
}
