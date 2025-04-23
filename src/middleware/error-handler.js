const logger = require('../utils/logger');

/**
 * Centralized error handling middleware
 */
class ErrorHandler {
  /**
   * Handle operational errors (expected errors)
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static handleOperationalError(err, req, res, next) {
    // Log the error
    logger.error('Operational Error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      body: req.body,
      params: req.params,
      query: req.query
    });

    // Respond with structured error
    res.status(err.status || 500).json({
      success: false,
      error: {
        message: err.message,
        code: err.code || 'INTERNAL_SERVER_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      }
    });
  }

  /**
   * Handle unexpected errors (programming errors)
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static handleUnexpectedError(err, req, res, next) {
    // Critical error logging
    logger.error('Unexpected Error', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });

    // Crash the application for unexpected errors
    process.exit(1);
  }

  /**
   * Validation error handler
   * @param {Array} errors - Validation errors
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  static handleValidationError(errors, req, res, next) {
    if (!errors.isEmpty()) {
      logger.warn('Validation Error', {
        errors: errors.array(),
        path: req.path,
        method: req.method
      });

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation Failed',
          details: errors.array().map(err => ({
            field: err.param,
            message: err.msg,
            location: err.location
          }))
        }
      });
    }
    next();
  }

  /**
   * 404 Not Found handler
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static handle404(req, res) {
    logger.warn('Not Found', {
      path: req.path,
      method: req.method
    });

    res.status(404).json({
      success: false,
      error: {
        message: 'Resource Not Found',
        code: 'NOT_FOUND'
      }
    });
  }
}

module.exports = ErrorHandler;