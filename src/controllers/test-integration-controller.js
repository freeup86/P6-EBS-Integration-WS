// src/controllers/test-integration-controller.js
const express = require('express');
const router = express.Router();
const ebsToP6Service = require('../services/ebs-to-p6-service');
const p6ToEBSService = require('../services/p6-to-ebs-service');
const logger = require('../utils/logger');

// Test authentication
router.get('/auth-test', async (req, res) => {
  try {
    logger.info('Testing authentication');
    
    // Try to authenticate with both services
    let p6Result = await ebsToP6Service.authenticateP6();
    let ebsResult = await ebsToP6Service.authenticateEBS();
    
    res.json({
      success: true,
      p6Auth: !!p6Result,
      ebsAuth: !!ebsResult,
      message: 'Authentication test completed successfully'
    });
  } catch (error) {
    logger.error('Authentication test failed:', error);
    res.status(500).json({
      success: false,
      message: `Authentication test failed: ${error.message}`
    });
  }
});

// Render the test UI
router.get('/ui', (req, res) => {
  res.render('test-integration', {
    title: 'Integration Testing'
  });
});

// Test P6 authentication
router.get('/test-p6-auth', async (req, res) => {
  try {
    logger.info('Testing P6 authentication');
    
    // Try to authenticate with P6
    let p6Result = await ebsToP6Service.authenticateP6();
    
    res.json({
      success: true,
      token: p6Result ? 'Valid token received' : 'No token received',
      message: 'P6 authentication completed successfully'
    });
  } catch (error) {
    logger.error('P6 authentication test failed:', error);
    res.status(500).json({
      success: false,
      message: `P6 authentication test failed: ${error.message}`
    });
  }
});

// Test EBS authentication
router.get('/test-ebs-auth', async (req, res) => {
  try {
    logger.info('Testing EBS authentication');
    
    // Try to authenticate with EBS
    let ebsResult = await ebsToP6Service.authenticateEBS();
    
    res.json({
      success: true,
      token: ebsResult ? 'Valid token received' : 'No token received',
      message: 'EBS authentication completed successfully'
    });
  } catch (error) {
    logger.error('EBS authentication test failed:', error);
    res.status(500).json({
      success: false,
      message: `EBS authentication test failed: ${error.message}`
    });
  }
});

// Export the router
module.exports = router;