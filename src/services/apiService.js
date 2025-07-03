const axios = require('axios');
const logger = require('../utils/logger');

/**
 * API Service for external API integration
 * Handles communication with JSONPlaceholder API
 */
class ApiService {
  constructor() {
    this.baseURL = process.env.EXTERNAL_API_URL || 'https://jsonplaceholder.typicode.com';
    this.timeout = parseInt(process.env.API_TIMEOUT) || 5000;

    // Create axios instance with default configuration
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mini-Project-3/1.0.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.api(`Making request to ${config.url}`, {
          method: config.method.toUpperCase(),
          url: config.url,
          params: config.params,
        });
        return config;
      },
      (error) => {
        logger.error('API request error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.api(`Response received from ${response.config.url}`, {
          status: response.status,
          dataLength: Array.isArray(response.data) ? response.data.length : 1,
        });
        return response;
      },
      (error) => {
        const errorInfo = {
          message: error.message,
          status: error.response?.status,
          statusText: error.response?.statusText,
          url: error.config?.url,
        };
        logger.error('API response error:', errorInfo);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Generic API call method
   * @param {string} endpoint - API endpoint
   * @param {object} options - Request options
   * @returns {Promise} - API response data
   */
  async makeRequest(endpoint, options = {}) {
    try {
      const response = await this.client({
        url: endpoint,
        ...options,
      });
      return response.data;
    } catch (error) {
      throw this.handleError(error, endpoint);
    }
  }

  /**
   * Get all users from external API
   * @returns {Promise<Array>} - Array of users
   */
  async getUsers() {
    try {
      return await this.makeRequest('/users');
    } catch (error) {
      logger.error('Failed to fetch users from external API:', error);
      throw error;
    }
  }

  /**
   * Get user by ID from external API
   * @param {number} id - User ID
   * @returns {Promise<Object>} - User object
   */
  async getUserById(id) {
    try {
      return await this.makeRequest(`/users/${id}`);
    } catch (error) {
      logger.error(`Failed to fetch user ${id} from external API:`, error);
      throw error;
    }
  }

  /**
   * Get all posts from external API
   * @returns {Promise<Array>} - Array of posts
   */
  async getPosts() {
    try {
      return await this.makeRequest('/posts');
    } catch (error) {
      logger.error('Failed to fetch posts from external API:', error);
      throw error;
    }
  }

  /**
   * Get post by ID from external API
   * @param {number} id - Post ID
   * @returns {Promise<Object>} - Post object
   */
  async getPostById(id) {
    try {
      return await this.makeRequest(`/posts/${id}`);
    } catch (error) {
      logger.error(`Failed to fetch post ${id} from external API:`, error);
      throw error;
    }
  }

  /**
   * Get posts by user ID from external API
   * @param {number} userId - User ID
   * @returns {Promise<Array>} - Array of posts
   */
  async getPostsByUserId(userId) {
    try {
      return await this.makeRequest('/posts', {
        params: { userId },
      });
    } catch (error) {
      logger.error(`Failed to fetch posts for user ${userId} from external API:`, error);
      throw error;
    }
  }

  /**
   * Get all comments from external API
   * @returns {Promise<Array>} - Array of comments
   */
  async getComments() {
    try {
      return await this.makeRequest('/comments');
    } catch (error) {
      logger.error('Failed to fetch comments from external API:', error);
      throw error;
    }
  }

  /**
   * Get comment by ID from external API
   * @param {number} id - Comment ID
   * @returns {Promise<Object>} - Comment object
   */
  async getCommentById(id) {
    try {
      return await this.makeRequest(`/comments/${id}`);
    } catch (error) {
      logger.error(`Failed to fetch comment ${id} from external API:`, error);
      throw error;
    }
  }

  /**
   * Get comments by post ID from external API
   * @param {number} postId - Post ID
   * @returns {Promise<Array>} - Array of comments
   */
  async getCommentsByPostId(postId) {
    try {
      return await this.makeRequest('/comments', {
        params: { postId },
      });
    } catch (error) {
      logger.error(`Failed to fetch comments for post ${postId} from external API:`, error);
      throw error;
    }
  }

  /**
   * Get albums from external API
   * @returns {Promise<Array>} - Array of albums
   */
  async getAlbums() {
    try {
      return await this.makeRequest('/albums');
    } catch (error) {
      logger.error('Failed to fetch albums from external API:', error);
      throw error;
    }
  }

  /**
   * Get photos from external API
   * @returns {Promise<Array>} - Array of photos
   */
  async getPhotos() {
    try {
      return await this.makeRequest('/photos');
    } catch (error) {
      logger.error('Failed to fetch photos from external API:', error);
      throw error;
    }
  }

  /**
   * Get todos from external API
   * @returns {Promise<Array>} - Array of todos
   */
  async getTodos() {
    try {
      return await this.makeRequest('/todos');
    } catch (error) {
      logger.error('Failed to fetch todos from external API:', error);
      throw error;
    }
  }

  /**
   * Test API connectivity
   * @returns {Promise<boolean>} - True if API is accessible
   */
  async testConnection() {
    try {
      const startTime = Date.now();
      await this.makeRequest('/users/1');
      const responseTime = Date.now() - startTime;

      logger.api('API connectivity test successful', {
        responseTime: `${responseTime}ms`,
        baseURL: this.baseURL,
      });

      return {
        success: true,
        responseTime,
        baseURL: this.baseURL,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('API connectivity test failed:', error);
      return {
        success: false,
        error: error.message,
        baseURL: this.baseURL,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get API health status
   * @returns {Promise<Object>} - Health status information
   */
  async getHealthStatus() {
    try {
      const startTime = Date.now();

      // Test multiple endpoints
      const tests = await Promise.allSettled([
        this.makeRequest('/users/1'),
        this.makeRequest('/posts/1'),
        this.makeRequest('/comments/1'),
      ]);

      const responseTime = Date.now() - startTime;
      const successCount = tests.filter(test => test.status === 'fulfilled').length;
      const isHealthy = successCount === tests.length;

      const status = {
        healthy: isHealthy,
        responseTime: `${responseTime}ms`,
        baseURL: this.baseURL,
        endpoints: {
          users: tests[0].status === 'fulfilled',
          posts: tests[1].status === 'fulfilled',
          comments: tests[2].status === 'fulfilled',
        },
        successRate: `${Math.round((successCount / tests.length) * 100)}%`,
        timestamp: new Date().toISOString(),
      };

      logger.api('API health check completed', status);
      return status;
    } catch (error) {
      logger.error('API health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        baseURL: this.baseURL,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Handle API errors
   * @param {Error} error - Original error
   * @param {string} endpoint - API endpoint
   * @returns {Error} - Formatted error
   */
  handleError(error, endpoint) {
    const errorInfo = {
      endpoint,
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    };

    // Create custom error with additional context
    const customError = new Error(`API Error: ${error.message}`);
    customError.name = 'ApiError';
    customError.status = error.response?.status || 500;
    customError.endpoint = endpoint;
    customError.originalError = error;

    // Specific error handling based on status code
    switch (error.response?.status) {
      case 404:
        customError.message = `Resource not found: ${endpoint}`;
        break;
      case 429:
        customError.message = 'Rate limit exceeded';
        break;
      case 500:
        customError.message = 'External API server error';
        break;
      case 503:
        customError.message = 'External API service unavailable';
        break;
      default:
        if (error.code === 'ECONNABORTED') {
          customError.message = 'Request timeout';
        } else if (error.code === 'ENOTFOUND') {
          customError.message = 'External API host not found';
        } else if (error.code === 'ECONNREFUSED') {
          customError.message = 'Connection refused by external API';
        }
    }

    return customError;
  }

  /**
   * Get rate limit information
   * @returns {Object} - Rate limit status
   */
  getRateLimitInfo() {
    return {
      hasRateLimit: false, // JSONPlaceholder doesn't have rate limiting
      remaining: 'unlimited',
      resetTime: null,
      limit: 'unlimited',
    };
  }

  /**
   * Batch request with retry logic
   * @param {Array} requests - Array of request configurations
   * @param {Object} options - Batch options
   * @returns {Promise<Array>} - Array of results
   */
  async batchRequest(requests, options = {}) {
    const {
      concurrency = 5,
      retryAttempts = 3,
      retryDelay = 1000,
    } = options;

    logger.api(`Starting batch request with ${requests.length} requests`, {
      concurrency,
      retryAttempts,
    });

    const results = [];
    const chunks = this.chunkArray(requests, concurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request, index) => {
        return this.retryRequest(request, retryAttempts, retryDelay);
      });

      const chunkResults = await Promise.allSettled(chunkPromises);
      results.push(...chunkResults);
    }

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    logger.api(`Batch request completed`, {
      total: requests.length,
      successful: successCount,
      failed: requests.length - successCount,
    });

    return results;
  }

  /**
   * Retry request with exponential backoff
   * @param {Object} request - Request configuration
   * @param {number} maxRetries - Maximum retry attempts
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {Promise} - Request result
   */
  async retryRequest(request, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest(request.endpoint, request.options);
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.api(`Request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`, {
          endpoint: request.endpoint,
          error: error.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Utility function to chunk array
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} - Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Utility function to sleep
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise} - Sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create and export singleton instance
const apiService = new ApiService();

module.exports = apiService;
