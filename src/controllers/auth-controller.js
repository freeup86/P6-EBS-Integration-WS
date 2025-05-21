// src/controllers/auth-controller.js
const express = require('express');
const router = express.Router();
const User = require('../models/user');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

// Function to get token expiration time (24 hours)
const getExpirationTime = () => {
  return Math.floor(Date.now() / 1000) + (24 * 60 * 60);
};

// Login route (POST /auth/login)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }
    
    // Find user
    const user = await User.findOne({ 
      where: { username, isActive: true } 
    });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
    
    // Validate password
    const isValidPassword = await user.validatePassword(password);
    
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid username or password' 
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.app.sessionSecret,
      { expiresIn: '24h' }
    );
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    // Return success
    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed' 
    });
  }
});

// Login page (GET /auth/login)
router.get('/login', (req, res) => {
  res.render('login', { 
    error: req.query.error || '',
    title: 'Login - P6-EBS Integration'
  });
});

// Form login (POST /auth/login-form)
router.post('/login-form', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.render('login', { 
        error: 'Username and password are required',
        title: 'Login - P6-EBS Integration'
      });
    }
    
    // Find user
    const user = await User.findOne({ 
      where: { username, isActive: true } 
    });
    
    if (!user) {
      return res.render('login', { 
        error: 'Invalid username or password',
        title: 'Login - P6-EBS Integration'
      });
    }
    
    // Validate password
    const isValidPassword = await user.validatePassword(password);
    
    if (!isValidPassword) {
      return res.render('login', { 
        error: 'Invalid username or password',
        title: 'Login - P6-EBS Integration'
      });
    }
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, username: user.username },
      config.app.sessionSecret,
      { expiresIn: '24h' }
    );
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    // Redirect to home
    res.redirect('/');
  } catch (error) {
    logger.error('Login form error:', error);
    res.render('login', { 
      error: 'An error occurred during login',
      title: 'Login - P6-EBS Integration'
    });
  }
});

// Logout route
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/auth/login');
});

module.exports = router;