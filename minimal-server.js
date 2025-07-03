const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

console.log('🚀 Starting minimal server...');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Create Express app
const app = express();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/miniproject3';
    console.log('🔌 Connecting to MongoDB:', mongoURI);

    const options = {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
    };

    const conn = await mongoose.connect(mongoURI, options);
    console.log('✅ MongoDB Connected:', conn.connection.host + ':' + conn.connection.port);
    console.log('📁 Database Name:', conn.connection.name);

    return conn;
  } catch (error) {
    console.error('❌ Error connecting to MongoDB:', error.message);

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.warn('⚠️ Development mode: continuing without database');
      return null;
    }
  }
};

// Connect to database
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
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  console.log('📊 Health check requested');
  res.json({
    success: true,
    message: 'Minimal server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('🏠 Root endpoint requested');
  res.json({
    success: true,
    message: 'Welcome to Mini Project 3: Minimal Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      users: '/api/users',
      posts: '/api/posts',
      comments: '/api/comments',
    },
  });
});

// Basic API endpoints
app.get('/api/users', (req, res) => {
  console.log('👥 Users endpoint requested');
  res.json({
    success: true,
    message: 'Users endpoint working',
    data: [],
    count: 0,
  });
});

app.get('/api/posts', (req, res) => {
  console.log('📝 Posts endpoint requested');
  res.json({
    success: true,
    message: 'Posts endpoint working',
    data: [],
    count: 0,
  });
});

app.get('/api/comments', (req, res) => {
  console.log('💬 Comments endpoint requested');
  res.json({
    success: true,
    message: 'Comments endpoint working',
    data: [],
    count: 0,
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log('❓ 404 - Route not found:', req.originalUrl);
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message,
  });
});

// Start server
const PORT = process.env.PORT || 3000;
console.log(`🌐 Starting server on port ${PORT}...`);

const server = app.listen(PORT, () => {
  console.log(`✅ Minimal server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🏠 Home: http://localhost:${PORT}/`);
  console.log(`🎯 PID: ${process.pid}`);
});

server.on('error', (error) => {
  console.error('❌ Server error:', error);
  if (error.code === 'EADDRINUSE') {
    console.error(`💡 Port ${PORT} is already in use. Try a different port.`);
  }
  process.exit(1);
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`🛑 ${signal} received, shutting down gracefully`);

  server.close(() => {
    console.log('✅ HTTP server closed');

    // Close database connection
    if (mongoose.connection.readyState === 1) {
      mongoose.connection.close(() => {
        console.log('✅ MongoDB connection closed');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('❌ Forcing shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

console.log('🔄 Minimal server setup complete, waiting for connections...');

module.exports = app;
