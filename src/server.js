const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import configurations and utilities
const connectDB = require('./config/database');
const logger = require('./utils/logger');
const swaggerSetup = require('./config/swagger');

// Import routes
const userRoutes = require('./routes/users');
const postRoutes = require('./routes/posts');
const commentRoutes = require('./routes/comments');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import services
const syncService = require('./services/syncService');

// Create Express app
const app = express();

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: process.env.CORS_CREDENTIALS === 'true',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Logging middleware
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim()),
  },
}));

// Body parsing middleware
app.use(express.json({
  limit: '10mb',
  type: 'application/json',
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Mini Project 3 API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: 'Connected',
    externalAPI: {
      url: process.env.EXTERNAL_API_URL,
      status: 'Available',
    },
  });
});

// API Routes
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

// Swagger documentation
swaggerSetup(app);

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Welcome to Mini Project 3: Real-time Database API',
    version: '1.0.0',
    description: 'External API integration with MongoDB following MVC pattern',
    documentation: {
      swagger: '/api/docs',
      health: '/api/health',
    },
    endpoints: {
      users: {
        'POST /api/users': 'Create a new user',
        'GET /api/users': 'Get all users (supports pagination, filtering)',
        'GET /api/users/:id': 'Get user by ID',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user',
        'POST /api/users/sync': 'Sync users from external API',
      },
      posts: {
        'POST /api/posts': 'Create a new post',
        'GET /api/posts': 'Get all posts (supports pagination, filtering)',
        'GET /api/posts/:id': 'Get post by ID',
        'PUT /api/posts/:id': 'Update post',
        'DELETE /api/posts/:id': 'Delete post',
        'GET /api/posts/user/:userId': 'Get posts by user',
        'POST /api/posts/sync': 'Sync posts from external API',
      },
      comments: {
        'POST /api/comments': 'Create a new comment',
        'GET /api/comments': 'Get all comments (supports pagination, filtering)',
        'GET /api/comments/:id': 'Get comment by ID',
        'PUT /api/comments/:id': 'Update comment',
        'DELETE /api/comments/:id': 'Delete comment',
        'GET /api/comments/post/:postId': 'Get comments by post',
        'POST /api/comments/sync': 'Sync comments from external API',
      },
      sync: {
        'POST /api/sync/all': 'Sync all data from external API',
        'POST /api/sync/users': 'Sync only users',
        'POST /api/sync/posts': 'Sync only posts',
        'POST /api/sync/comments': 'Sync only comments',
      },
    },
    features: [
      'Full CRUD operations',
      'External API integration (JSONPlaceholder)',
      'MongoDB with Mongoose ODM',
      'MVC architecture pattern',
      'Data validation and sanitization',
      'Comprehensive error handling',
      'Request logging',
      'API documentation with Swagger',
      'Health monitoring',
      'Auto-sync capabilities',
    ],
  });
});

// Sync endpoint
app.post('/api/sync/all', async (req, res) => {
  try {
    logger.info('Manual sync initiated');
    const result = await syncService.syncAll();
    res.json({
      success: true,
      message: 'Data synchronization completed successfully',
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Manual sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Data synchronization failed',
      error: error.message,
    });
  }
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      documentation: '/api/docs',
      health: '/api/health',
      users: '/api/users',
      posts: '/api/posts',
      comments: '/api/comments',
    },
  });
});

// Global error handler
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/api/health`);
  logger.info(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initial sync if enabled
  if (process.env.AUTO_SYNC_ON_START === 'true') {
    logger.info('🔄 Starting initial data synchronization...');
    syncService.syncAll()
      .then((result) => {
        logger.info('✅ Initial synchronization completed:', result);
      })
      .catch((error) => {
        logger.error('❌ Initial synchronization failed:', error);
      });
  }
});

// Graceful shutdown handlers
const gracefulShutdown = (signal) => {
  logger.info(`🛑 ${signal} received, shutting down gracefully`);

  server.close(() => {
    logger.info('✅ HTTP server closed');

    // Close database connection
    const mongoose = require('mongoose');
    mongoose.connection.close(() => {
      logger.info('✅ MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('❌ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;
