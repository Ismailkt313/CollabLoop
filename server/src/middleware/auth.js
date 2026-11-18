import jwt from 'jsonwebtoken';
import { User, ProjectMember } from '../models/index.js';

/**
 * Middleware that verifies the JWT from a cookie or Authorization header
 * and attaches the authenticated user to `req.user`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireAuth(req, res, next) {
  try {
    const token =
      req.cookies.collabloop_session ||
      req.get('authorization')?.replace(/^Bearer /, '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({ error: 'Session is no longer valid' });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/**
 * Middleware that checks the authenticated user is an active member of the
 * project identified by `req.params.projectId`. Attaches the membership
 * document to `req.membership`.
 *
 * Must be used after `requireAuth`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function requireMembership(req, res, next) {
  try {
    const member = await ProjectMember.findOne({
      projectId: req.params.projectId,
      userId: req.user.id,
      status: 'active',
    });

    if (!member) {
      return res.status(404).json({ error: 'Project not found' });
    }

    req.membership = member;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Middleware that ensures `req.membership.projectRole` is `"owner"` or
 * `"admin"`. Must be used after `requireMembership`.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function requireManager(req, res, next) {
  if (!['owner', 'admin'].includes(req.membership?.projectRole)) {
    return res.status(403).json({ error: 'Project admin permission required' });
  }
  next();
}

/**
 * Middleware that ensures `req.membership.projectRole` is strictly `"owner"`.
 * Must be used after `requireMembership`.
 */
export function requireOwner(req, res, next) {
  if (req.membership?.projectRole !== 'owner') {
    return res.status(403).json({ error: 'Only the project owner can perform this action' });
  }
  next();
}
