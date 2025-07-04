const mongoose = require("mongoose");

// Counter Schema for auto-incrementing IDs
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter = mongoose.model("Counter", counterSchema);

// User Schema for tracking user preferences and stats
const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    default: () =>
      `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  },
  sessionId: {
    type: String,
    required: true,
  },
  preferences: {
    favoriteBreeds: [String],
    viewHistory: [
      {
        breed: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  stats: {
    imagesViewed: {
      type: Number,
      default: 0,
    },
    breedsExplored: {
      type: Number,
      default: 0,
    },
    sessionCount: {
      type: Number,
      default: 1,
    },
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Favorite Images Schema
const favoriteImageSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  imageUrl: {
    type: String,
    required: true,
  },
  breed: {
    type: String,
    required: true,
  },
  breedDisplayName: {
    type: String,
    required: true,
  },
  subBreed: {
    type: String,
    default: null,
  },
  tags: [String],
  notes: {
    type: String,
    maxlength: 500,
  },
  addedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index for efficient queries
favoriteImageSchema.index({ userId: 1, breed: 1 });
favoriteImageSchema.index({ userId: 1, addedAt: -1 });

// API Usage Analytics Schema
const apiUsageSchema = new mongoose.Schema({
  endpoint: {
    type: String,
    required: true,
  },
  method: {
    type: String,
    required: true,
    enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  },
  userId: String,
  sessionId: String,
  responseTime: {
    type: Number, // in milliseconds
    required: true,
  },
  statusCode: {
    type: Number,
    required: true,
  },
  userAgent: String,
  ipAddress: String,
  requestSize: Number, // in bytes
  responseSize: Number, // in bytes
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  metadata: {
    breed: String,
    count: Number,
    searchQuery: String,
    error: String,
  },
});

// Index for analytics queries
apiUsageSchema.index({ endpoint: 1, timestamp: -1 });
apiUsageSchema.index({ timestamp: -1 });

// Breed Cache Schema for storing external API data
const breedCacheSchema = new mongoose.Schema({
  breedId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  breed: {
    type: String,
    required: true,
  },
  subBreed: {
    type: String,
    default: null,
  },
  displayName: {
    type: String,
    required: true,
  },
  images: [
    {
      url: String,
      verified: {
        type: Boolean,
        default: false,
      },
      lastChecked: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  popularity: {
    viewCount: {
      type: Number,
      default: 0,
    },
    favoriteCount: {
      type: Number,
      default: 0,
    },
    searchCount: {
      type: Number,
      default: 0,
    },
  },
  metadata: {
    externalApiLastSync: {
      type: Date,
      default: Date.now,
    },
    imageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
breedCacheSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient breed searches
breedCacheSchema.index({ breed: 1, subBreed: 1 });
breedCacheSchema.index({ name: "text", displayName: "text" });
breedCacheSchema.index({ "popularity.viewCount": -1 });

// Server Statistics Schema
const serverStatsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    default: () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return today;
    },
  },
  metrics: {
    totalRequests: {
      type: Number,
      default: 0,
    },
    uniqueUsers: {
      type: Number,
      default: 0,
    },
    imagesServed: {
      type: Number,
      default: 0,
    },
    breedsViewed: {
      type: Number,
      default: 0,
    },
    favoritesAdded: {
      type: Number,
      default: 0,
    },
    searchesPerformed: {
      type: Number,
      default: 0,
    },
    averageResponseTime: {
      type: Number,
      default: 0,
    },
    errorCount: {
      type: Number,
      default: 0,
    },
  },
  endpoints: {
    health: { type: Number, default: 0 },
    all: { type: Number, default: 0 },
    breeds: { type: Number, default: 0 },
    random: { type: Number, default: 0 },
    breedImages: { type: Number, default: 0 },
    breedRandom: { type: Number, default: 0 },
    dogs: { type: Number, default: 0 },
    search: { type: Number, default: 0 },
    stats: { type: Number, default: 0 },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
serverStatsSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Error Log Schema for debugging and monitoring
const errorLogSchema = new mongoose.Schema({
  level: {
    type: String,
    required: true,
    enum: ["error", "warn", "info", "debug"],
    default: "error",
  },
  message: {
    type: String,
    required: true,
  },
  stack: String,
  endpoint: String,
  method: String,
  userId: String,
  sessionId: String,
  requestData: mongoose.Schema.Types.Mixed,
  userAgent: String,
  ipAddress: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  resolved: {
    type: Boolean,
    default: false,
  },
  metadata: mongoose.Schema.Types.Mixed,
});

// Index for efficient error log queries
errorLogSchema.index({ level: 1, timestamp: -1 });
errorLogSchema.index({ resolved: 1, timestamp: -1 });

// Dog Schema for CRUD operations
const dogSchema = new mongoose.Schema({
  id: {
    type: Number,
    unique: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  breed: {
    type: String,
    required: true,
    trim: true,
  },
  age: {
    type: Number,
    min: 0,
    max: 30,
  },
  colour: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    maxlength: 1000,
  },
  imageUrl: {
    type: String,
    validate: {
      validator: function (v) {
        return !v || /^https?:\/\/.+/.test(v);
      },
      message: "Image URL must be a valid HTTP/HTTPS URL",
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Auto-increment the ID field
dogSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        "dogId",
        { $inc: { seq: 1 } },
        { new: true, upsert: true },
      );
      this.id = counter.seq;
    } catch (error) {
      return next(error);
    }
  }
  this.updatedAt = Date.now();
  next();
});

// Index for efficient searches
dogSchema.index({ breed: 1 });
dogSchema.index({ name: "text", breed: "text", description: "text" });

// Create models
const User = mongoose.model("User", userSchema);
const FavoriteImage = mongoose.model("FavoriteImage", favoriteImageSchema);
const ApiUsage = mongoose.model("ApiUsage", apiUsageSchema);
const BreedCache = mongoose.model("BreedCache", breedCacheSchema);
const ServerStats = mongoose.model("ServerStats", serverStatsSchema);
const ErrorLog = mongoose.model("ErrorLog", errorLogSchema);
const Dog = mongoose.model("Dog", dogSchema);

module.exports = {
  User,
  FavoriteImage,
  ApiUsage,
  BreedCache,
  ServerStats,
  ErrorLog,
  Dog,
  Counter,
};
