const axios = require('axios');
const logger = require('./logger');
const config = require('../config');
// Imports for robust cookie handling
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

/**
 * Create a simple API client with standard configuration (if still needed)
 * @param {Object} simpleClientConfig - Configuration object (e.g., baseUrl, timeout)
 * @returns {Object} - Configured axios instance
 */
function createApiClient(simpleClientConfig) {
  const client = axios.create({
    baseURL: simpleClientConfig.baseUrl,
    timeout: simpleClientConfig.timeout || 30000,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });

  // Optional: Add basic logging interceptors if desired
  client.interceptors.request.use(
    (requestConfig) => {
      logger.debug(`Simple API Request: ${requestConfig.method.toUpperCase()} ${requestConfig.url}`);
      return requestConfig;
    },
    (error) => {
      logger.error('Simple API Request Error:', error);
      return Promise.reject(error);
    }
  );
  client.interceptors.response.use(
    (response) => {
      logger.debug(`Simple API Response (${response.status}): ${response.config.method.toUpperCase()} ${response.config.url}`);
      return response;
    },
    (error) => {
      // Log simple client errors
      return Promise.reject(error);
    }
  );
  return client;
}


/**
 * Advanced API Client with P6 Session Login (using custom headers & cookie jar), error handling.
 * @param {Object} clientConfig - Configuration for the API client (e.g., config.p6 or config.ebs)
 * @returns {Object} - Configured axios instance wrapped with cookie jar support
 */
function createAdvancedApiClient(clientConfig) {
  // Create a cookie jar instance for this client
  const cookieJar = new CookieJar();

  // Wrap the Axios instance with the cookie jar support
  const client = wrapper(axios.create({
    baseURL: clientConfig.baseUrl,
    timeout: clientConfig.timeout || 30000,
    jar: cookieJar, // Associate the cookie jar
    headers: {
      'Accept': 'application/json' // Default Accept header
      // Content-Type will be set as needed per request
    }
    // 'withCredentials' is not needed when using the wrapper/jar
  }));

  let loginAttempted = false;
  let loginSuccessful = false;
  const loginPath = '/restapi/login'; // P6 Login path

  // Performs the P6 login based on POST /restapi/login, custom headers, DatabaseName query param
  async function performP6Login() {
    if (loginAttempted) {
      if (!loginSuccessful) throw new Error('Previous P6 login attempt failed.');
      logger.debug('Skipping P6 login, already attempted successfully this session.');
      return true;
    }
    loginAttempted = true; // Mark attempt

    if (!clientConfig.username || !clientConfig.password || !clientConfig.databaseName) {
      logger.error('P6 login cannot proceed: Missing username, password, or databaseName in config.');
      throw new Error('Missing P6 login configuration.');
    }

    const dbName = encodeURIComponent(clientConfig.databaseName);
    const loginUrl = `${loginPath}?DatabaseName=${dbName}`;

    logger.info(`Attempting P6 login via POST to: ${loginUrl} using custom headers`);

    try {
      const response = await client.post(loginUrl, null, { // POST with null body
        headers: {
          'username': clientConfig.username,
          'password': clientConfig.password,
          // Let default Accept header ('application/json') be used
        }
      });

      // Check for successful response (status code and potentially body message)
      if (response.status >= 200 && response.status < 300 && response.data?.message === "Login successful.") {
        logger.info(`P6 login successful (Status: ${response.status}). Cookie Jar active for subsequent requests.`);
        loginSuccessful = true;
        return true;
      } else {
        logger.error('P6 login returned non-success status or unexpected body:', { status: response.status, body: response.data });
        loginSuccessful = false;
        throw new Error(`P6 login failed or returned unexpected response (Status: ${response.status})`);
      }

    } catch (error) {
      loginSuccessful = false;
      const status = error.response?.status;
      const responseData = error.response?.data;
      logger.error('P6 Authentication Error during login request', {
        message: error.message,
        url: loginUrl,
        status: status,
        responseData: responseData
      });

      if (status === 401) {
        throw new Error('P6 Authentication failed: Invalid username/password headers or DatabaseName (401).');
      } else if (status === 404) {
        throw new Error(`P6 Authentication failed: Login endpoint not found (${loginPath}) - Check P6_API_URL base path (404).`);
      } else {
        // Include status in generic error if available
        throw new Error(`Failed to authenticate with P6.${status ? ' Status: ' + status : ''}`);
      }
    }
  } // --- END performP6Login ---

  // Request interceptor: Ensure login happens once before other requests for P6 clients
  client.interceptors.request.use(async (requestConfig) => {
    const isP6Client = !!clientConfig.databaseName; // Identify P6 client by databaseName config
    const isLoginRequest = requestConfig.url.includes(loginPath);

    if (isP6Client && !loginSuccessful && !isLoginRequest) {
      logger.debug('P6 Login required before making request to:', requestConfig.url);
      try {
        await performP6Login(); // This will throw if fails, preventing original request
      } catch (loginError) {
        logger.error(`Blocking request to ${requestConfig.url} due to P6 login failure.`);
        // Propagate a clear error about login failure
        throw new Error(`P6 Login Required: ${loginError.message}`);
      }
    }

    // Log request before sending
    logger.debug(`API Request: ${requestConfig.method.toUpperCase()} ${requestConfig.baseURL}${requestConfig.url}`);
    // Consider masking sensitive headers if needed in logs:
    // const safeHeaders = { ...requestConfig.headers };
    // if (safeHeaders.password) safeHeaders.password = '***';
    // logger.debug('Headers:', safeHeaders);
    return requestConfig;

  }, (error) => {
    // Handle errors during request setup phase
    logger.error('API Request Setup Error:', error.message);
    return Promise.reject(error);
  });

  // Response interceptor: Log errors, potentially handle retries or specific statuses
  client.interceptors.response.use(
    response => {
      // Log basic success info
      logger.debug(`API Response: ${response.config.method.toUpperCase()} ${response.config.url} Status: ${response.status}`);
      return response; // Pass successful response through
    },
    async error => {
      // Log detailed errors on failure
      if (error.response) {
        // Server responded with a status code outside the 2xx range
        logger.error('API Error Response', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: error.config?.url,
          method: error.config?.method,
          responseData: error.response.data, // Log response body on error
        });
        // Check if it was a permission error after a successful login attempt
        if ((error.response.status === 401 || error.response.status === 403) && loginSuccessful) {
          logger.error(`Authorization error (${error.response.status}) on request to ${error.config?.url} despite successful login. Check P6 user permissions for this specific action/resource.`);
        }
      } else if (error.request) {
        // The request was made but no response was received
        logger.error('No response received for API request', {
            url: error.config?.url,
            method: error.config?.method,
            code: error.code, // e.g., ECONNABORTED, ECONNREFUSED, ETIMEDOUT
            error: error.message
            });
      } else {
        // Something happened in setting up the request that triggered an Error
        logger.error('Error setting up API request', error.message);
      }

      // Reject the promise so the calling function's catch block can handle it
      return Promise.reject(error);
    }
  );

  return client; // Return the wrapped client instance
} // end createAdvancedApiClient

module.exports = {
  createApiClient,          // Export simple client if used elsewhere
  createAdvancedApiClient
};