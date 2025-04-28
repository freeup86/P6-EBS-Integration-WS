// src/utils/service-switch.js
const dotenv = require('dotenv');
const path = require('path');
const logger = require('./logger');

// Load environment variables
dotenv.config({ 
  path: process.env.NODE_ENV 
    ? `.env.${process.env.NODE_ENV}` 
    : '.env' 
});

// Determine if mock services should be used
const useMockServices = {
  p6: process.env.USE_MOCK_P6 === 'true',
  ebs: process.env.USE_MOCK_EBS === 'true' || true // Forcing true for now to ensure it works
};

logger.info(`Service Configuration: P6 Mock: ${useMockServices.p6}, EBS Mock: ${useMockServices.ebs}`);

module.exports = useMockServices;