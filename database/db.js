const mongoose = require("mongoose");

let cachedConnection = null;

const connectToDatabase = async () => {
  if (cachedConnection) {
    console.log("Using cached database connection");
    return cachedConnection;
  }

  try {
    const mongoUri = process.env.MONGODB_URI;

    if (!mongoUri) {
      throw new Error("MONGODB_URI environment variable is not defined");
    }

    console.log("Connecting to MongoDB...");

    const connection = await mongoose.connect(mongoUri, {
      maxPoolSize: 10, // Maximum number of connections in the pool
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
    });

    cachedConnection = connection;
    console.log("✅ Connected to MongoDB Atlas");

    return connection;
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    throw error;
  }
};

const disconnectFromDatabase = async () => {
  if (cachedConnection) {
    await mongoose.disconnect();
    cachedConnection = null;
    console.log("🔌 Disconnected from MongoDB");
  }
};

// Handle connection events
mongoose.connection.on("connected", () => {
  console.log("📡 Mongoose connected to MongoDB");
});

mongoose.connection.on("error", (err) => {
  console.error("❌ Mongoose connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("📡 Mongoose disconnected from MongoDB");
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await disconnectFromDatabase();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await disconnectFromDatabase();
  process.exit(0);
});

module.exports = {
  connectToDatabase,
  disconnectFromDatabase,
};
