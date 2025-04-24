// Enhanced configuration management
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables based on NODE_ENV
const envFile = process.env.NODE_ENV 
  ? `.env.${process.env.NODE_ENV}` 
  : '.env';

// Check if environment-specific file exists
if (fs.existsSync(path.resolve(process.cwd(), envFile))) {
  dotenv.config({ path: envFile });
} else {
  dotenv.config();
}

// Validate required configuration
const requiredEnvVars = [
  'P6_API_URL', 'P6_USERNAME', 'P6_PASSWORD',
  'EBS_API_URL', 'EBS_USERNAME', 'EBS_PASSWORD'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

module.exports = {
  // Primavera P6 API configuration
  p6: {
    baseUrl: process.env.P6_API_URL,
    username: process.env.P6_USERNAME,
    password: process.env.P6_PASSWORD,
    databaseName: process.env.P6_DATABASE_NAME,
    // clientId: process.env.P6_CLIENT_ID,
    // clientSecret: process.env.P6_CLIENT_SECRET,
    timeout: parseInt(process.env.P6_API_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.P6_RETRY_ATTEMPTS) || 3
  },
  
  // Oracle EBS API configuration
  ebs: {
    baseUrl: process.env.EBS_API_URL,
    username: process.env.EBS_USERNAME,
    password: process.env.EBS_PASSWORD,
    clientId: process.env.EBS_CLIENT_ID,
    clientSecret: process.env.EBS_CLIENT_SECRET,
    authType: process.env.EBS_AUTH_TYPE || 'oauth',
    timeout: parseInt(process.env.EBS_API_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.EBS_RETRY_ATTEMPTS) || 3
  },
  
  // Application settings
  app: {
    sessionSecret: process.env.SESSION_SECRET || 'fallback-secret',
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'production',
    logLevel: process.env.LOG_LEVEL || 'info',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  }
};