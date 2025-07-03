const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));

// In-memory storage for demo purposes
let breedCache = {};
let favoriteImages = [];
let userStats = {
  imagesServed: 0,
  breedsViewed: 0,
  favoritesCount: 0,
  serverStartTime: Date.now(),
};

// Dog API base URL
const DOG_API_BASE = "https://dog.ceo/api";

// Utility function to log requests
const logRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
};

app.use(logRequest);

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "PupHub API",
      version: "1.0.0",
      description:
        "A comprehensive RESTful API for dog breed information and images",
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: "Development server",
      },
    ],
  },
  apis: ["./puphub-server.js"], // Path to the API files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Load the external swagger specification
const swaggerDocument = JSON.parse(
  fs.readFileSync("./swagger/swagger.json", "utf8"),
);

// Swagger UI setup
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// API documentation JSON endpoint
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerDocument);
});

// Root route - serve main control page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  const uptime = Date.now() - userStats.serverStartTime;
  const uptimeSeconds = Math.floor(uptime / 1000);

  res.json({
    status: "healthy",
    service: "PupHub API",
    version: "1.0.0",
    uptime: `${uptimeSeconds}s`,
    timestamp: new Date().toISOString(),
    stats: {
      imagesServed: userStats.imagesServed,
      breedsViewed: userStats.breedsViewed,
      favoritesCount: userStats.favoritesCount,
    },
    endpoints: {
      breeds: "/api/breeds",
      randomDog: "/api/random",
      breedImages: "/api/breeds/:breed/images",
      favorites: "/api/favorites",
      stats: "/api/stats",
    },
  });
});

// Get all dog breeds
app.get("/api/breeds", async (req, res) => {
  try {
    const response = await axios.get(`${DOG_API_BASE}/breeds/list/all`);

    if (response.data.status === "success") {
      breedCache = response.data.message;

      // Transform breeds into a more usable format
      const breeds = [];
      for (const [breed, subBreeds] of Object.entries(breedCache)) {
        if (subBreeds.length > 0) {
          for (const subBreed of subBreeds) {
            breeds.push({
              id: `${breed}-${subBreed}`,
              name: `${breed} ${subBreed}`,
              breed: breed,
              subBreed: subBreed,
              displayName: `${breed.charAt(0).toUpperCase() + breed.slice(1)} ${subBreed.charAt(0).toUpperCase() + subBreed.slice(1)}`,
            });
          }
        } else {
          breeds.push({
            id: breed,
            name: breed,
            breed: breed,
            subBreed: null,
            displayName: breed.charAt(0).toUpperCase() + breed.slice(1),
          });
        }
      }

      res.json({
        success: true,
        count: breeds.length,
        data: breeds,
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error("Failed to fetch breeds from Dog API");
    }
  } catch (error) {
    console.error("Error fetching breeds:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch dog breeds",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get random dog image
app.get("/api/random", async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 1;
    const maxCount = Math.min(count, 50); // Limit to 50 images max

    const promises = Array.from({ length: maxCount }, () =>
      axios.get(`${DOG_API_BASE}/breeds/image/random`),
    );

    const results = await Promise.all(promises);
    const images = results
      .filter((result) => result.data.status === "success")
      .map((result) => ({
        url: result.data.message,
        id: Date.now() + Math.random(),
        timestamp: new Date().toISOString(),
      }));

    userStats.imagesServed += images.length;

    res.json({
      success: true,
      count: images.length,
      data: maxCount === 1 ? images[0] : images,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching random dog:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch random dog image",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get images for a specific breed
app.get("/api/breeds/:breed/images", async (req, res) => {
  try {
    const { breed } = req.params;
    const count = parseInt(req.query.count) || 10;
    const maxCount = Math.min(count, 50); // Limit to 50 images max

    // Check if it's a sub-breed (contains hyphen)
    const breedPath = breed.includes("-") ? breed.replace("-", "/") : breed;

    const response = await axios.get(
      `${DOG_API_BASE}/breed/${breedPath}/images`,
    );

    if (response.data.status === "success") {
      const allImages = response.data.message;
      const selectedImages = allImages.slice(0, maxCount).map((url) => ({
        url,
        id: Date.now() + Math.random(),
        breed: breed,
        timestamp: new Date().toISOString(),
      }));

      userStats.imagesServed += selectedImages.length;
      userStats.breedsViewed++;

      res.json({
        success: true,
        breed: breed,
        count: selectedImages.length,
        totalAvailable: allImages.length,
        data: selectedImages,
        timestamp: new Date().toISOString(),
      });
    } else {
      throw new Error(`Breed '${breed}' not found`);
    }
  } catch (error) {
    console.error(
      `Error fetching images for breed ${req.params.breed}:`,
      error.message,
    );
    res.status(404).json({
      success: false,
      error: `Failed to fetch images for breed '${req.params.breed}'`,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get random image for a specific breed
app.get("/api/breeds/:breed/random", async (req, res) => {
  try {
    const { breed } = req.params;
    const count = parseInt(req.query.count) || 1;
    const maxCount = Math.min(count, 10);

    const breedPath = breed.includes("-") ? breed.replace("-", "/") : breed;

    const promises = Array.from({ length: maxCount }, () =>
      axios.get(`${DOG_API_BASE}/breed/${breedPath}/images/random`),
    );

    const results = await Promise.all(promises);
    const images = results
      .filter((result) => result.data.status === "success")
      .map((result) => ({
        url: result.data.message,
        id: Date.now() + Math.random(),
        breed: breed,
        timestamp: new Date().toISOString(),
      }));

    userStats.imagesServed += images.length;

    res.json({
      success: true,
      breed: breed,
      count: images.length,
      data: maxCount === 1 ? images[0] : images,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      `Error fetching random image for breed ${req.params.breed}:`,
      error.message,
    );
    res.status(404).json({
      success: false,
      error: `Failed to fetch random image for breed '${req.params.breed}'`,
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Favorites endpoints
app.get("/api/favorites", (req, res) => {
  res.json({
    success: true,
    count: favoriteImages.length,
    data: favoriteImages,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/favorites", (req, res) => {
  try {
    const { url, breed, name } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "Image URL is required",
        timestamp: new Date().toISOString(),
      });
    }

    // Check if already favorited
    const existingFavorite = favoriteImages.find((fav) => fav.url === url);
    if (existingFavorite) {
      return res.status(409).json({
        success: false,
        error: "Image already in favorites",
        timestamp: new Date().toISOString(),
      });
    }

    const favorite = {
      id: Date.now() + Math.random(),
      url,
      breed: breed || "unknown",
      name: name || "Favorite Dog",
      addedAt: new Date().toISOString(),
    };

    favoriteImages.push(favorite);
    userStats.favoritesCount++;

    res.status(201).json({
      success: true,
      message: "Added to favorites",
      data: favorite,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error adding to favorites:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to add to favorites",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

app.delete("/api/favorites/:id", (req, res) => {
  try {
    const { id } = req.params;
    const index = favoriteImages.findIndex((fav) => fav.id.toString() === id);

    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: "Favorite not found",
        timestamp: new Date().toISOString(),
      });
    }

    const removed = favoriteImages.splice(index, 1)[0];
    userStats.favoritesCount--;

    res.json({
      success: true,
      message: "Removed from favorites",
      data: removed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error removing from favorites:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to remove from favorites",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Stats endpoint
app.get("/api/stats", (req, res) => {
  const uptime = Date.now() - userStats.serverStartTime;
  const uptimeMinutes = Math.floor(uptime / 60000);
  const uptimeSeconds = Math.floor((uptime % 60000) / 1000);

  res.json({
    success: true,
    data: {
      ...userStats,
      uptime: {
        milliseconds: uptime,
        display:
          uptimeMinutes > 0
            ? `${uptimeMinutes}m ${uptimeSeconds}s`
            : `${uptimeSeconds}s`,
      },
      totalBreeds: Object.keys(breedCache).length,
      serverStartTime: new Date(userStats.serverStartTime).toISOString(),
    },
    timestamp: new Date().toISOString(),
  });
});

// Search breeds endpoint
app.get("/api/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search query must be at least 2 characters",
        timestamp: new Date().toISOString(),
      });
    }

    const searchQuery = q.toLowerCase().trim();
    const results = [];

    // Search through cached breeds
    for (const [breed, subBreeds] of Object.entries(breedCache)) {
      if (breed.toLowerCase().includes(searchQuery)) {
        if (subBreeds.length > 0) {
          for (const subBreed of subBreeds) {
            results.push({
              id: `${breed}-${subBreed}`,
              name: `${breed} ${subBreed}`,
              breed: breed,
              subBreed: subBreed,
              displayName: `${breed.charAt(0).toUpperCase() + breed.slice(1)} ${subBreed.charAt(0).toUpperCase() + subBreed.slice(1)}`,
            });
          }
        } else {
          results.push({
            id: breed,
            name: breed,
            breed: breed,
            subBreed: null,
            displayName: breed.charAt(0).toUpperCase() + breed.slice(1),
          });
        }
      } else {
        // Search sub-breeds
        for (const subBreed of subBreeds) {
          if (subBreed.toLowerCase().includes(searchQuery)) {
            results.push({
              id: `${breed}-${subBreed}`,
              name: `${breed} ${subBreed}`,
              breed: breed,
              subBreed: subBreed,
              displayName: `${breed.charAt(0).toUpperCase() + breed.slice(1)} ${subBreed.charAt(0).toUpperCase() + subBreed.slice(1)}`,
            });
          }
        }
      }
    }

    res.json({
      success: true,
      query: q,
      count: results.length,
      data: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error searching breeds:", error.message);
    res.status(500).json({
      success: false,
      error: "Failed to search breeds",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Test Dog API connectivity
app.get("/api/test-connection", async (req, res) => {
  try {
    const startTime = Date.now();
    const response = await axios.get(`${DOG_API_BASE}/breeds/list/all`);
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      dogApiStatus: "connected",
      responseTime: `${responseTime}ms`,
      breedsAvailable: Object.keys(response.data.message).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error testing Dog API connection:", error.message);
    res.status(500).json({
      success: false,
      dogApiStatus: "disconnected",
      error: "Failed to connect to Dog API",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      "GET /": "PupHub Control Center",
      "GET /api/health": "API health check",
      "GET /api/breeds": "List all dog breeds",
      "GET /api/random": "Get random dog image(s)",
      "GET /api/breeds/:breed/images": "Get images for specific breed",
      "GET /api/breeds/:breed/random": "Get random image for specific breed",
      "GET /api/favorites": "Get favorite images",
      "POST /api/favorites": "Add image to favorites",
      "DELETE /api/favorites/:id": "Remove image from favorites",
      "GET /api/stats": "Get server statistics",
      "GET /api/search": "Search dog breeds",
      "GET /api/test-connection": "Test Dog API connectivity",
    },
    timestamp: new Date().toISOString(),
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    message: err.message,
    timestamp: new Date().toISOString(),
  });
});

// Start server
const server = app.listen(PORT, async () => {
  console.log("\n🐕 ===== PUPHUB SERVER =====");
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🎮 Control Center: http://localhost:${PORT}`);
  console.log(`🌐 Frontend: http://localhost:${PORT}/frontend`);
  console.log(`❤️  Health Check: http://localhost:${PORT}/api/health`);
  console.log("");
  console.log("📋 Available API Endpoints:");
  console.log(`   • List Breeds: GET http://localhost:${PORT}/api/breeds`);
  console.log(`   • Random Dog: GET http://localhost:${PORT}/api/random`);
  console.log(
    `   • Breed Images: GET http://localhost:${PORT}/api/breeds/:breed/images`,
  );
  console.log(
    `   • Search Breeds: GET http://localhost:${PORT}/api/search?q=labrador`,
  );
  console.log(`   • Favorites: GET http://localhost:${PORT}/api/favorites`);
  console.log(`   • Statistics: GET http://localhost:${PORT}/api/stats`);
  console.log("");
  console.log("📚 API Documentation:");
  console.log(`   • Swagger UI: http://localhost:${PORT}/api-docs`);
  console.log(`   • OpenAPI Spec: http://localhost:${PORT}/api-docs.json`);
  console.log("");

  // Test Dog API connectivity on startup
  try {
    const response = await axios.get(`${DOG_API_BASE}/breeds/list/all`);
    if (response.data.status === "success") {
      breedCache = response.data.message;
      console.log(
        `🐕 Dog API connected successfully! ${Object.keys(breedCache).length} breeds available`,
      );
    }
  } catch (error) {
    console.log("⚠️  Warning: Could not connect to Dog API on startup");
    console.log(
      "   The API will still work, but breed data will be fetched on demand",
    );
  }

  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log("🐾 Ready to serve some adorable dogs!");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed successfully");
    console.log("👋 PupHub server shutdown complete");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed successfully");
    console.log("👋 PupHub server shutdown complete");
    process.exit(0);
  });
});

module.exports = app;
