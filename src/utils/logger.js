const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about the colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...meta } = info;
    const metaString = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaString}`;
  })
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: process.env.NODE_ENV === 'production' ? format : consoleFormat,
  }),

  // File transport for all logs
  new winston.transports.File({
    filename: path.join(logsDir, 'app.log'),
    level: 'info',
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 10,
  }),

  // File transport for error logs
  new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    format: format,
    maxsize: 5242880, // 5MB
    maxFiles: 10,
  }),
];

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
  exitOnError: false,
});

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'exceptions.log'),
    format: format,
  })
);

// Handle unhandled promise rejections
logger.rejections.handle(
  new winston.transports.File({
    filename: path.join(logsDir, 'rejections.log'),
    format: format,
  })
);

// Custom methods for common use cases
logger.database = (message, meta = {}) => {
  logger.info(`[DATABASE] ${message}`, meta);
};

logger.api = (message, meta = {}) => {
  logger.info(`[API] ${message}`, meta);
};

logger.sync = (message, meta = {}) => {
  logger.info(`[SYNC] ${message}`, meta);
};

logger.auth = (message, meta = {}) => {
  logger.info(`[AUTH] ${message}`, meta);
};

logger.performance = (message, meta = {}) => {
  logger.info(`[PERFORMANCE] ${message}`, meta);
};

// Function to log request details
logger.request = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    };

    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, logData);
    } else {
      logger.http(`HTTP ${res.statusCode} - ${req.method} ${req.originalUrl}`, logData);
    }
  });

  if (next) next();
};

// Function to create child logger with additional context
logger.child = (context) => {
  return {
    error: (message, meta = {}) => logger.error(message, { ...context, ...meta }),
    warn: (message, meta = {}) => logger.warn(message, { ...context, ...meta }),
    info: (message, meta = {}) => logger.info(message, { ...context, ...meta }),
    http: (message, meta = {}) => logger.http(message, { ...context, ...meta }),
    debug: (message, meta = {}) => logger.debug(message, { ...context, ...meta }),
  };
};

// Function to get log file paths
logger.getLogFiles = () => {
  return {
    app: path.join(logsDir, 'app.log'),
    error: path.join(logsDir, 'error.log'),
    exceptions: path.join(logsDir, 'exceptions.log'),
    rejections: path.join(logsDir, 'rejections.log'),
  };
};

// Function to clear log files (for testing)
logger.clearLogs = () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Log clearing only allowed in test environment');
  }

  const logFiles = logger.getLogFiles();
  Object.values(logFiles).forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
};

module.exports = logger;
