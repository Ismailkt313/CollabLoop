import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { User } from '../models/index.js';
import {
  safeUser,
  cookieOptions,
  signToken,
  hashPassword,
  passwordMatches,
} from '../utils/auth.js';
import config from '../config/index.js';

/**
 * GET /auth/username-availability
 * Check if a given username is available and valid.
 */
export async function checkUsernameAvailability(req, res) {
  const username = String(req.query.username || '').toLowerCase();
  if (!/^[a-z0-9_]{3,30}$/.test(username)) {
    return res.json({ available: false });
  }
  const exists = await User.exists({ username });
  res.json({ available: !exists });
}

/**
 * POST /auth/forgot-password
 * Send a password reset email if the user exists and SMTP is configured.
 */
export async function forgotPassword(req, res, next) {
  try {
    const smtp = config.smtp;
    if (!smtp.host || !smtp.user || !smtp.pass || !smtp.from) {
      return res.status(503).json({
        error:
          'Password recovery email is not configured. Please contact your workspace administrator.',
      });
    }

    const user = await User.findOne({
      email: String(req.body.email || '').toLowerCase(),
    });

    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = crypto
        .createHash('sha256')
        .update(token)
        .digest('hex');
      user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const transport = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: { user: smtp.user, pass: smtp.pass },
      });

      const link = `${config.clientOrigin}/?token=${token}`;
      await transport.sendMail({
        from: smtp.from,
        to: user.email,
        subject: 'Reset your CollabLoop password',
        text: `Use this link to reset your password. It expires in 30 minutes: ${link}`,
        html: `<p>Use the secure link below to reset your CollabLoop password. It expires in 30 minutes.</p><p><a href="${link}">Reset password</a></p>`,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /auth/reset-password
 * Reset user password using token from reset email.
 */
export async function resetPassword(req, res, next) {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Reset token and new password are required' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: hash,
      passwordResetExpires: { $gt: new Date() },
    }).select('+passwordResetTokenHash');

    if (!user) {
      return res.status(400).json({
        error: 'This password reset link is invalid or expired. Request a new one.',
      });
    }

    user.passwordHash = await hashPassword(password);
    user.passwordScheme = 'sha256-bcrypt';
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

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
      return res.status(400).json({ error: 'Username must be 3–30 letters, numbers, or underscores' });
    }
    if (password.length < 10) {
      return res.status(400).json({ error: 'Password must be at least 10 characters' });
    }

    const normalizedUsername = username.toLowerCase();

    if (
      await User.exists({
        $or: [{ username: normalizedUsername }, { email: email.toLowerCase() }],
      })
    ) {
      return res.status(409).json({ error: 'Username or email is already registered' });
    }

    const user = await User.create({
      name: name.trim(),
      username: normalizedUsername,
      email: email.toLowerCase(),
      passwordHash: await hashPassword(password),
      passwordScheme: 'sha256-bcrypt',
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
 * Authenticate with email or username + password and set session cookie.
 */
export async function login(req, res, next) {
  try {
    const identifier = String(req.body.email || '')
      .trim()
      .replace(/^@/, '')
      .toLowerCase();

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select('+passwordHash');

    if (!user || !(await passwordMatches(user, req.body.password || ''))) {
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
