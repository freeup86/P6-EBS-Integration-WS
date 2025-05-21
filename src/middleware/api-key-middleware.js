// src/middleware/api-key-middleware.js
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware to verify API key for integration services
 * This provides a simple authentication method for external applications
 * to call the integration APIs without needing OAuth/JWT authentication
 */
const verifyApiKey = (req, res, next) => {
  try {
    // Get API key from header, query parameter, or body
    const apiKey = 
      req.headers['x-api-key'] || 
      req.query.apiKey || 
      (req.body && req.body.apiKey);

    // Check if API key is provided
    if (!apiKey) {
      logger.warn('API key missing in request', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        error: {
          message: 'API key is required',
          code: 'MISSING_API_KEY'
        }
      });
    }

    // Validate API key with the configured value
    // We'll support comma-separated values for multiple valid keys
    const validApiKeys = (config.integration?.apiKeys || '').split(',').map(key => key.trim());
    
    if (!validApiKeys.includes(apiKey)) {
      logger.warn('Invalid API key used', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'Invalid API key',
          code: 'INVALID_API_KEY'
        }
      });
    }

    // API key is valid, add a flag to request for tracking
    req.authenticatedByApiKey = true;
    logger.info('Request authenticated via API key', {
      path: req.path,
      method: req.method
    });
    
    next();
  } catch (error) {
    logger.error('Error in API key authentication:', error);
    
    res.status(500).json({
      success: false,
      error: {
        message: 'Authentication error',
        code: 'AUTH_ERROR'
      }
    });
  }
};

module.exports = {
  verifyApiKey
};