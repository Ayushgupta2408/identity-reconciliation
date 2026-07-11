const logger = require('../utils/logger');

/**
 * Centralized error handler.
 *
 * Bonus requirement ("misdirect potential threats / misleading error
 * responses"): we log full error details server-side for debugging, but
 * the client only ever sees a generic, non-revealing message for anything
 * that isn't a clean validation error. This avoids leaking stack traces,
 * SQL fragments, or internal file paths to a probing client — a standard
 * defensive practice, not actual deception of legitimate users.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.isOperational ? err.statusCode : 500;

  logger.error(err.message, {
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  if (err.isOperational) {
    return res.status(statusCode).json({
      error: err.message,
    });
  }

  // Unexpected/server-side failure: never leak internals.
  return res.status(500).json({
    error: 'Something went wrong while processing your request.',
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Resource not found' });
}

module.exports = { errorHandler, notFoundHandler };
