const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * Custom Morgan logging middleware
 * Provides detailed logging with different formats for dev and production
 */
const morganMiddleware = morgan((tokens, req, res) => {
  // Sensitive data to be masked
  const sensitiveFields = ['password', 'token', 'authorization'];
  
  // Mask sensitive data in request body
  const maskSensitiveData = (body) => {
    if (!body) return body;
    
    const maskedBody = { ...body };
    sensitiveFields.forEach(field => {
      if (maskedBody[field]) {
        maskedBody[field] = '***MASKED***';
      }
    });
    
    return maskedBody;
  };

  // Log additional context for errors
  if (parseInt(tokens.status(req, res)) >= 400) {
    logger.error('HTTP Error', {
      method: tokens.method(req, res),
      url: tokens.url(req, res),
      status: tokens.status(req, res),
      responseTime: tokens['response-time'](req, res),
      requestBody: maskSensitiveData(req.body),
      requestParams: req.params,
      requestQuery: req.query,
      userAgent: req.get('User-Agent'),
      remoteIP: req.ip
    });
  }

  // Combine morgan's default logging with custom logging
  const logMessage = [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens['response-time'](req, res) + ' ms'
  ].join(' ');

  // Log based on environment
  if (process.env.NODE_ENV === 'production') {
    logger.info(logMessage);
  } else {
    // More verbose logging in development
    logger.debug(logMessage, {
      headers: req.headers,
      body: maskSensitiveData(req.body)
    });
  }

  return null; // Morgan will handle the actual logging
});

module.exports = morganMiddleware;