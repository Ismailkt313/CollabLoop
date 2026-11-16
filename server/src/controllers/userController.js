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
 * Search for users by username prefix (min 2 chars).
 */
export async function searchUsers(req, res) {
  const term = String(req.query.q || '').replace(/^@/, '');

  if (term.length < 2) {
    return res.json({ users: [] });
  }

  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const users = await User.find({
    username: { $regex: '^' + escapedTerm, $options: 'i' },
    _id: { $ne: req.user.id },
  })
    .select('name username avatar')
    .limit(10);

  res.json({ users });
}
