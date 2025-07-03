const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * Handles all errors that occur in the application
 */
const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Internal Server Error';
  let errorType = error.name || 'Error';

  // Log the error with context
  const errorContext = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.body,
    params: req.params,
    query: req.query,
    stack: error.stack,
  };

  // Log error with appropriate level
  if (statusCode >= 500) {
    logger.error(`${errorType}: ${message}`, errorContext);
  } else {
    logger.warn(`${errorType}: ${message}`, errorContext);
  }

  // Handle specific error types
  switch (errorType) {
    case 'ValidationError':
      statusCode = 400;
      message = handleValidationError(error);
      break;

    case 'CastError':
      statusCode = 400;
      message = handleCastError(error);
      break;

    case 'MongoError':
    case 'MongoServerError':
      statusCode = 400;
      message = handleMongoError(error);
      break;

    case 'MulterError':
      statusCode = 400;
      message = handleMulterError(error);
      break;

    case 'JsonWebTokenError':
      statusCode = 401;
      message = 'Invalid token';
      break;

    case 'TokenExpiredError':
      statusCode = 401;
      message = 'Token expired';
      break;

    case 'SyntaxError':
      if (error.message.includes('JSON')) {
        statusCode = 400;
        message = 'Invalid JSON format';
      }
      break;

    default:
      // Handle HTTP errors
      if (error.statusCode || error.status) {
        statusCode = error.statusCode || error.status;
        message = error.message;
      }
  }

  // Prepare error response
  const errorResponse = {
    success: false,
    message,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method,
  };

  // Add error details in development mode
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = {
      type: errorType,
      stack: error.stack,
      details: error.details || null,
    };
  }

  // Add validation errors if available
  if (error.errors) {
    errorResponse.validationErrors = error.errors;
  }

  // Send error response
  res.status(statusCode).json(errorResponse);
};

/**
 * Handle Mongoose validation errors
 */
const handleValidationError = (error) => {
  const errors = Object.values(error.errors).map(err => ({
    field: err.path,
    message: err.message,
    value: err.value,
  }));

  return {
    message: 'Validation failed',
    errors,
  };
};

/**
 * Handle Mongoose cast errors (invalid ObjectId, etc.)
 */
const handleCastError = (error) => {
  return `Invalid ${error.path}: ${error.value}`;
};

/**
 * Handle MongoDB errors
 */
const handleMongoError = (error) => {
  if (error.code === 11000) {
    // Duplicate key error
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return `Duplicate value for ${field}: ${value}. Please use a different value.`;
  }

  if (error.code === 11001) {
    return 'Duplicate key error';
  }

  return error.message || 'Database operation failed';
};

/**
 * Handle Multer file upload errors
 */
const handleMulterError = (error) => {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return 'File too large';
    case 'LIMIT_FILE_COUNT':
      return 'Too many files';
    case 'LIMIT_UNEXPECTED_FILE':
      return 'Unexpected file field';
    default:
      return error.message || 'File upload error';
  }
};

/**
 * Handle async errors in route handlers
 * Wrapper function to catch async errors and pass them to error handler
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Create custom error
 */
const createError = (message, statusCode = 500, type = 'Error') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.name = type;
  return error;
};

/**
 * Not found middleware
 * Handles 404 errors for undefined routes
 */
const notFound = (req, res, next) => {
  const error = createError(`Route not found: ${req.originalUrl}`, 404, 'NotFoundError');
  next(error);
};

/**
 * Validation error handler
 * Handles express-validator errors
 */
const handleValidationErrors = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.param,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    const error = createError('Validation failed', 400, 'ValidationError');
    error.errors = formattedErrors;
    return next(error);
  }

  next();
};

/**
 * Rate limit error handler
 */
const rateLimitHandler = (req, res) => {
  logger.warn(`Rate limit exceeded for IP: ${req.ip}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    path: req.originalUrl,
  });

  res.status(429).json({
    success: false,
    message: 'Too many requests from this IP, please try again later',
    timestamp: new Date().toISOString(),
    retryAfter: req.rateLimit?.resetTime || null,
  });
};

/**
 * CORS error handler
 */
const corsErrorHandler = (err, req, res, next) => {
  if (err && err.message && err.message.includes('CORS')) {
    logger.warn(`CORS error: ${err.message}`, {
      origin: req.get('Origin'),
      method: req.method,
      path: req.originalUrl,
    });

    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      timestamp: new Date().toISOString(),
    });
  }

  next(err);
};

module.exports = {
  errorHandler,
  asyncHandler,
  createError,
  notFound,
  handleValidationErrors,
  rateLimitHandler,
  corsErrorHandler,
};
