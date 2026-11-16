import jwt from 'jsonwebtoken';

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
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers.cookie
        ?.split('; ')
        .find((x) => x.startsWith('collabloop_session='))
        ?.split('=')[1];

    if (!token) {
      throw new Error();
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = { ...payload, id: payload.sub };
    next();
  } catch {
    next(new Error('Unauthorized'));
  }
}
