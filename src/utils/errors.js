/**
 * Custom error hierarchy so the error-handling middleware can distinguish
 * "expected" client errors (bad payload) from unexpected server faults.
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Invalid request payload') {
    super(message, 400);
  }
}

module.exports = { AppError, ValidationError };
