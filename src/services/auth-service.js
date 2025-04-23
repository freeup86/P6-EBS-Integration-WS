const axios = require('axios');
const cache = require('memory-cache');
const logger = require('../utils/logger');
const config = require('../config');

class AuthService {
  constructor() {
    this.tokenCache = new cache.Cache();
  }

  /**
   * Get access token for P6
   * @returns {Promise<string>} Access token
   */
  async getP6Token() {
    const cacheKey = 'P6_ACCESS_TOKEN';
    const cachedToken = this.tokenCache.get(cacheKey);

    if (cachedToken) {
      return cachedToken;
    }

    try {
      const response = await axios.post(`${config.p6.baseUrl}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: config.p6.clientId,
        client_secret: config.p6.clientSecret
      });

      const { access_token, expires_in } = response.data;
      
      // Cache token with expiration
      this.tokenCache.put(cacheKey, access_token, (expires_in - 300) * 1000);

      return access_token;
    } catch (error) {
      logger.error('P6 Token Retrieval Failed', error);
      throw new Error('Failed to retrieve P6 access token');
    }
  }

  /**
   * Get access token for EBS
   * @returns {Promise<string>} Access token
   */
  async getEBSToken() {
    const cacheKey = 'EBS_ACCESS_TOKEN';
    const cachedToken = this.tokenCache.get(cacheKey);

    if (cachedToken) {
      return cachedToken;
    }

    try {
      const response = await axios.post(`${config.ebs.baseUrl}/oauth/token`, {
        grant_type: 'client_credentials',
        client_id: config.ebs.clientId,
        client_secret: config.ebs.clientSecret
      });

      const { access_token, expires_in } = response.data;
      
      // Cache token with expiration
      this.tokenCache.put(cacheKey, access_token, (expires_in - 300) * 1000);

      return access_token;
    } catch (error) {
      logger.error('EBS Token Retrieval Failed', error);
      throw new Error('Failed to retrieve EBS access token');
    }
  }
}

module.exports = new AuthService();