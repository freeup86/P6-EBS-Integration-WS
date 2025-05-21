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
    title: 'Integration Testing',
    user: null
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

// Test P6 Connection
router.get('/test-p6-connection', async (req, res) => {
  try {
    logger.info('Testing P6 API connection');
    const response = await p6Client.get('/restapi/project', {
      params: {
        Fields: 'ObjectId,Id,Name',
        MaxRows: 5 // Limit to 5 projects
      }
    });
    
    res.json({
      success: true,
      message: 'P6 connection successful',
      data: response.data,
      count: Array.isArray(response.data) ? response.data.length : 0
    });
  } catch (error) {
    logger.error('P6 connection test failed:', error);
    res.status(500).json({
      success: false,
      message: `P6 connection test failed: ${error.message}`,
      error: error.response?.data || error.message
    });
  }
});

// Test Create Project
router.get('/create-test-p6-project', async (req, res) => {
  try {
    // First, get available EPS nodes
    const epsResponse = await p6Client.get('/restapi/eps', {
      params: {
        Fields: 'ObjectId,Id,Name'
      }
    });

    if (!epsResponse.data || !epsResponse.data.length) {
      return res.status(400).json({
        success: false,
        message: 'No EPS nodes found. Cannot create project without a parent EPS.'
      });
    }

    const parentEpsObjectId = epsResponse.data[0].ObjectId;
    
    // Create a test project
    const createP6ProjectData = [{
      Name: 'Test Project ' + Date.now(),
      Id: 'TEST' + Date.now(),
      ParentEPSObjectId: parentEpsObjectId,
      Status: "Active",
      Description: `Test project created via API`
    }];
    
    const createResponse = await p6Client.post('/restapi/project', createP6ProjectData);
    
    res.json({
      success: true,
      message: 'Test project created successfully',
      project: createResponse.data
    });
  } catch (error) {
    logger.error('Error creating test project:', error);
    res.status(500).json({
      success: false,
      message: `Error creating test project: ${error.message}`,
      error: error.response?.data || error.message
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