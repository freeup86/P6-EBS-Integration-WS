const axios = require('axios');
const logger = require('./logger');

/**
 * Create an API client with standard configuration
 * @param {Object} config - Configuration object
 * @returns {Object} - Configured axios instance
 */
function createApiClient(config) {
  // Create axios instance with base configuration
  const client = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout || 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Add request interceptor for logging
  client.interceptors.request.use(
    (requestConfig) => {
      // Don't log authorization headers
      const sanitizedConfig = { ...requestConfig };
      if (sanitizedConfig.headers && sanitizedConfig.headers.Authorization) {
        sanitizedConfig.headers.Authorization = '***REDACTED***';
      }
      
      logger.debug(`API Request: ${requestConfig.method.toUpperCase()} ${requestConfig.baseURL}${requestConfig.url}`, 
        sanitizedConfig);
      return requestConfig;
    },
    (error) => {
      logger.error('API Request Error:', error);
      return Promise.reject(error);
    }
  );

  // Add response interceptor for logging
  client.interceptors.response.use(
    (response) => {
      logger.debug(`API Response (${response.status}): ${response.config.method.toUpperCase()} ${response.config.url}`);
      return response;
    },
    (error) => {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        logger.error(`API Error Response (${error.response.status}): ${error.config.method.toUpperCase()} ${error.config.url}`, {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        // The request was made but no response was received
        logger.error(`API No Response Error: ${error.config.method.toUpperCase()} ${error.config.url}`, {
          request: error.request,
          message: error.message
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error(`API Request Setup Error: ${error.message}`);
      }
      
      return Promise.reject(error);
    }
  );

  // Add retry functionality
  let retryCount = 0;
  const maxRetries = config.retryAttempts || 3;
  
  // Create a retry handler
  const retryHandler = async (error) => {
    const originalRequest = error.config;
    
    // If we have a network error or 5xx response and have not reached the max retries
    if ((error.code === 'ECONNABORTED' || 
        (error.response && error.response.status >= 500)) && 
        retryCount < maxRetries) {
      
      retryCount++;
      logger.warn(`Retrying request (attempt ${retryCount}/${maxRetries}): ${originalRequest.method.toUpperCase()} ${originalRequest.url}`);
      
      // Exponential backoff
      const delay = Math.pow(2, retryCount) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return client(originalRequest);
    }
    
    return Promise.reject(error);
  };
  
  // Add retry intercept
  client.interceptors.response.use(
    response => response, 
    error => retryHandler(error)
  );

  return client;
}

/**
 * Advanced API Client with robust error handling and retry mechanisms
 * @param {Object} config - Configuration for the API client
 * @returns {Object} - Configured axios instance
 */
function createAdvancedApiClient(config) {
  const client = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout || 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Token management
  let accessToken = null;
  let tokenExpiration = null;

  // Request interceptor for adding authentication
  client.interceptors.request.use(async (requestConfig) => {
    try {
      // Check and refresh token if needed
      if (!accessToken || Date.now() >= tokenExpiration) {
        await refreshAccessToken();
      }

      // Add token to request
      if (accessToken) {
        requestConfig.headers['Authorization'] = `Bearer ${accessToken}`;
      }

      return requestConfig;
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw error;
    }
  });

  // Refresh token method
  async function refreshAccessToken() {
    try {
      // Implement token refresh logic specific to your authentication method
      const response = await axios.post(`${config.baseUrl}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: config.clientSecret
      });

      accessToken = response.data.access_token;
      // Set expiration to 5 minutes before actual expiration
      tokenExpiration = Date.now() + (response.data.expires_in - 300) * 1000;
    } catch (error) {
      logger.error('Authentication failed', error);
      throw error;
    }
  }

  // Response interceptor for logging and error handling
  client.interceptors.response.use(
    response => {
      logger.info(`API Response: ${response.config.method.toUpperCase()} ${response.config.url}`);
      return response;
    },
    async error => {
      const originalRequest = error.config;

      // Retry mechanism for certain status codes
      if (error.response && [401, 403, 500, 502, 503, 504].includes(error.response.status)) {
        if (!originalRequest._retryCount) {
          originalRequest._retryCount = 0;
        }

        if (originalRequest._retryCount < (config.retryAttempts || 3)) {
          originalRequest._retryCount++;
          
          // Exponential backoff
          const backoffDelay = Math.pow(2, originalRequest._retryCount) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffDelay));

          return client(originalRequest);
        }
      }

      // Detailed error logging
      if (error.response) {
        logger.error('API Error Response', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
      } else if (error.request) {
        logger.error('No response received', error.request);
      } else {
        logger.error('Error setting up request', error.message);
      }

      return Promise.reject(error);
    }
  );

  return client;
}

module.exports = {
  createApiClient,
  createAdvancedApiClient
};