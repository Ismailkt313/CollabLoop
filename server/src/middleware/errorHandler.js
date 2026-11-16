/**
 * Global Express error-handling middleware.
 * Logs the error and returns a JSON response with an appropriate status code.
 *
 * @param {Error & { status?: number }} err
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
export function errorHandler(err, _req, res, _next) {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
}
