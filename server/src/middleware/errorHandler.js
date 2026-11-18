import config from '../config/index.js';

/**
 * Global Express error-handling middleware.
 * Logs the error securely and returns a sanitized JSON response with an appropriate status code.
 *
 * @param {Error & { status?: number, statusCode?: number, code?: number, errors?: Record<string, { message: string }> }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, req, res, _next) {
  // Always log server errors with timestamp, method and URL
  console.error(`[ERROR] [${new Date().toISOString()}] ${req.method} ${req.originalUrl}:`, err);

  // Mongoose Validation Error -> 400 Bad Request
  if (err.name === 'ValidationError') {
    const messages = err.errors
      ? Object.values(err.errors).map((e) => e.message)
      : ['Invalid input data'];
    return res.status(400).json({
      error: messages.join('. '),
    });
  }

  // Mongoose CastError (e.g. invalid ObjectId) -> 400 Bad Request
  if (err.name === 'CastError') {
    return res.status(400).json({
      error: `Invalid format for field: ${err.path || 'identifier'}`,
    });
  }

  // MongoDB duplicate key error -> 409 Conflict
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    const fieldName = fields.length > 0 ? fields.join(', ') : 'field';
    return res.status(409).json({
      error: `A record with this ${fieldName} already exists`,
    });
  }

  // Client-safe explicit HTTP status errors (e.g., 400, 401, 403, 404, 429)
  const statusCode = err.status || err.statusCode || 500;

  if (statusCode < 500) {
    return res.status(statusCode).json({
      error: err.message || 'Request failed',
    });
  }

  // 500 Internal Server Error - Sanitized in production to avoid leaking database or stack internals
  if (config.isProduction) {
    return res.status(500).json({
      error: 'Internal server error',
    });
  }

  return res.status(500).json({
    error: err.message || 'Internal server error',
    stack: err.stack,
  });
}
