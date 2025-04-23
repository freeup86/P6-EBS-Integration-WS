module.exports = {
  // Primavera P6 API configuration
  p6: {
    baseUrl: process.env.P6_API_URL,
    username: process.env.P6_USERNAME,
    password: process.env.P6_PASSWORD,
    authType: process.env.P6_AUTH_TYPE || 'basic', // 'basic', 'oauth', or 'token'
    timeout: parseInt(process.env.P6_API_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.P6_RETRY_ATTEMPTS) || 3
  },
  
  // Oracle EBS API configuration
  ebs: {
    baseUrl: process.env.EBS_API_URL,
    username: process.env.EBS_USERNAME,
    password: process.env.EBS_PASSWORD,
    authType: process.env.EBS_AUTH_TYPE || 'basic', // 'basic', 'oauth', or 'token'
    timeout: parseInt(process.env.EBS_API_TIMEOUT) || 30000,
    retryAttempts: parseInt(process.env.EBS_RETRY_ATTEMPTS) || 3
  },
  
  // Application settings
  app: {
    sessionSecret: process.env.SESSION_SECRET,
    port: process.env.PORT || 3000,
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  }
};