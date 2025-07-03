const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectDB = async () => {
  try {
    const mongoURI =
      process.env.MONGODB_URI || "mongodb://localhost:27017/miniproject3";

    const options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      bufferCommands: false, // Disable mongoose buffering
      bufferMaxEntries: 0, // Disable mongoose buffering
    };

    const conn = await mongoose.connect(mongoURI, options);

    logger.info(
      `✅ MongoDB Connected: ${conn.connection.host}:${conn.connection.port}`,
    );
    logger.info(`📁 Database Name: ${conn.connection.name}`);

    // Connection event listeners
    mongoose.connection.on("connected", () => {
      logger.info("🔗 Mongoose connected to MongoDB");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("❌ Mongoose connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("⚠️ Mongoose disconnected from MongoDB");
    });

    // Note: SIGINT handler should be set up in the main server file, not here
    // to avoid conflicts with the main application's shutdown handlers

    return conn;
  } catch (error) {
    logger.error("❌ Error connecting to MongoDB:", error.message);

    // Exit process with failure
    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    } else {
      logger.warn("⚠️ Development mode: continuing without database");
      return null;
    }
  }
};

// Function to check database connection status
const checkConnection = () => {
  const state = mongoose.connection.readyState;
  const states = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  return {
    state: states[state] || "unknown",
    isConnected: state === 1,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    database: mongoose.connection.name,
  };
};

// Function to get database statistics
const getDatabaseStats = async () => {
  try {
    if (mongoose.connection.readyState !== 1) {
      throw new Error("Database not connected");
    }

    const admin = mongoose.connection.db.admin();
    const stats = await admin.serverStatus();

    return {
      uptime: stats.uptime,
      connections: stats.connections,
      memory: stats.mem,
      version: stats.version,
      host: stats.host,
    };
  } catch (error) {
    logger.error("Error getting database stats:", error);
    return null;
  }
};

// Function to clean up test data (useful for testing)
const cleanupTestData = async () => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("Cleanup only allowed in test environment");
  }

  try {
    const collections = await mongoose.connection.db.collections();

    for (const collection of collections) {
      await collection.deleteMany({});
    }

    logger.info("🧹 Test data cleaned up successfully");
  } catch (error) {
    logger.error("Error cleaning up test data:", error);
    throw error;
  }
};

module.exports = {
  connectDB,
  checkConnection,
  getDatabaseStats,
  cleanupTestData,
};
