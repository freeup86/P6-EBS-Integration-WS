const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');

const createRateLimiter = (options = {}) => {
  const limiter = rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // Default 15 minutes
    max: options.max || 100, // Limit each IP to 100 requests per window
    standardHeaders: true, // Return rate limit info in RateLimit-* headers
    legacyHeaders: false, // Disable X-RateLimit-* headers
    handler: (req, res) => {
      logger.warn(`Rate limit exceeded for IP: ${req.ip}`);
      res.status(429).json({
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil(req.rateLimit.resetTime / 1000 / 60)
      });
    },
    ...options
  });

  return limiter;
};

// Get config
const config = require('../config');

module.exports = {
  // General API rate limiter
  apiLimiter: createRateLimiter(),
  
  // Stricter limiter for authentication endpoints
  authLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 login attempts per 15 minutes
  }),
  
  // More lenient limiter for public endpoints
  publicLimiter: createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 50
  }),
  
  // Special rate limiter for integration API with higher limits
  integrationLimiter: createRateLimiter({
    windowMs: config.integration?.rateLimitWindowMs || 60 * 60 * 1000, // Default 60 minutes
    max: config.integration?.rateLimitMax || 1000, // Higher limit for integration services
    keyGenerator: (req) => {
      // Use API key as rate limit key if available, otherwise fallback to IP
      return req.headers['x-api-key'] || req.ip;
    }
  })
};