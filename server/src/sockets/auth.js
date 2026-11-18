import jwt from 'jsonwebtoken';
import config from '../config/index.js';

/**
 * Socket.IO authentication middleware.
 * Extracts a JWT from `socket.handshake.auth.token` or the
 * `collabloop_session` cookie and attaches the decoded user to `socket.user`.
 *
 * @param {import('socket.io').Socket} socket
 * @param {(err?: Error) => void} next
 */
export function socketAuth(socket, next) {
  try {
    let token = socket.handshake.auth?.token;
    if (!token && socket.handshake.headers?.cookie) {
      const match = socket.handshake.headers.cookie
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('collabloop_session='));
      if (match) {
        token = decodeURIComponent(match.split('=')[1]);
      }
    }

    if (!token) {
      return next(new Error('Unauthorized'));
    }

    const secret = process.env.JWT_SECRET || config.jwtSecret;
    const payload = jwt.verify(token, secret);
    socket.user = { ...payload, id: payload.sub || payload.id };
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}
