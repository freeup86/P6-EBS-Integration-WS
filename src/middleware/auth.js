const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

module.exports = (req, res, next) => {
  // Skip authentication for public routes
  if (req.path === '/' || req.path === '/login') {
    return next();
  }
  
  // Check for token in cookies or Authorization header
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    logger.warn('Authentication failed: No token provided');
    return res.redirect('/login');
  }
  
  try {
    // Verify the token
    const decoded = jwt.verify(token, config.app.sessionSecret);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.redirect('/login');
  }
};