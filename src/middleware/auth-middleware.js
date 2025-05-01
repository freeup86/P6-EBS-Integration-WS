// src/middleware/auth-middleware.js
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Middleware to verify JWT token and add user to request
 */
const authenticateJWT = (req, res, next) => {
  try {
    // Skip authentication for public routes
    if (req.path === '/login' || 
        req.path === '/auth/login' || 
        req.path === '/auth/login-form' || 
        req.path.startsWith('/css/') ||
        req.path.startsWith('/js/')) {
      return next();
    }
    
    // Get token from cookies or Authorization header
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      // For API requests, return 401
      if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication required' 
        });
      }
      
      // For web requests, redirect to login
      return res.redirect('/auth/login');
    }
    
    // Verify token
    const decoded = jwt.verify(token, config.app.sessionSecret);
    
    // Add user to request
    req.user = {
      id: decoded.id,
      username: decoded.username
    };
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    // For API requests, return 401
    if (req.xhr || req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid or expired token' 
      });
    }
    
    // For web requests, redirect to login
    res.redirect('/auth/login?error=Session expired. Please login again.');
  }
};

module.exports = {
  authenticateJWT
};