const { body, param, query, validationResult } = require('express-validator');
const ErrorHandler = require('./error-handler');

class ValidationMiddleware {
  /**
   * Validate project sync request
   */
  static projectSyncValidation() {
    return [
      param('projectId')
        .trim()
        .notEmpty().withMessage('Project ID is required')
        .isAlphanumeric().withMessage('Project ID must be alphanumeric')
        .isLength({ min: 3, max: 20 }).withMessage('Project ID must be between 3 and 20 characters')
    ];
  }

  /**
   * Validate task sync request
   */
  static taskSyncValidation() {
    return [
      param('projectId')
        .trim()
        .notEmpty().withMessage('Project ID is required')
        .isAlphanumeric().withMessage('Project ID must be alphanumeric')
        .isLength({ min: 3, max: 20 }).withMessage('Project ID must be between 3 and 20 characters'),
      body('syncOptions')
        .optional()
        .isObject().withMessage('Sync options must be an object')
    ];
  }

  /**
   * Validate resource sync request
   */
  static resourceSyncValidation() {
    return [
      body('resourceIds')
        .optional()
        .isArray().withMessage('Resource IDs must be an array')
        .custom((value) => {
          return value.every(id => /^[A-Z0-9-]+$/.test(id));
        }).withMessage('Invalid resource ID format')
    ];
  }

  /**
   * Middleware to process validation results
   */
  static processValidationResults(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return ErrorHandler.handleValidationError(errors, req, res, next);
    }
    next();
  }
}

module.exports = ValidationMiddleware;