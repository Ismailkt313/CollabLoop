import { User } from '../models/index.js';
import { safeUser } from '../utils/auth.js';

/**
 * PATCH /users/me
 * Update the authenticated user's profile (name, avatar).
 */
export async function updateProfile(req, res, next) {
  try {
    if (req.body.username || req.body.email) {
      return res.status(400).json({ error: 'Username and email cannot be changed here' });
    }

    req.user.name = String(req.body.name || req.user.name).trim();

    if (req.body.avatar !== undefined) {
      req.user.avatar = req.body.avatar;
    }

    await req.user.save();
    res.json({ user: safeUser(req.user) });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /users/search
 * Search for registered users by username, email, or display name (min 2 chars).
 * Excludes the requester.
 */
export async function searchUsers(req, res, next) {
  try {
    const rawTerm = String(req.query.q || '').trim();
    const term = rawTerm.replace(/^@/, '').trim();

    if (term.length < 2) {
      return res.json({ users: [] });
    }

    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'i');

    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { username: regex },
        { email: regex },
        { name: regex },
      ],
    })
      .select('name username email avatar')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ users });
  } catch (err) {
    next(err);
  }
}
