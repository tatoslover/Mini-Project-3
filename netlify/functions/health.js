const { connectToDatabase } = require("../../database/db");
const { ServerStats } = require("../../database/models");

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: "",
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: "Method not allowed",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  const startTime = Date.now();

  try {
    // Connect to database
    await connectToDatabase();

    // Get basic server stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await ServerStats.findOne({ date: today });
    const responseTime = Date.now() - startTime;

    // Calculate uptime (simplified for serverless)
    const serverStartTime = process.env.DEPLOY_TIME || Date.now();
    const uptime = Date.now() - parseInt(serverStartTime);
    const uptimeSeconds = Math.floor(uptime / 1000);

    const healthData = {
      status: "healthy",
      service: "Barkend API",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "production",
      uptime: `${uptimeSeconds}s`,
      responseTime: `${responseTime}ms`,
      timestamp: new Date().toISOString(),
      database: {
        status: "connected",
        type: "MongoDB Atlas",
      },
      stats: {
        imagesServed: todayStats?.metrics?.imagesServed || 0,
        breedsViewed: todayStats?.metrics?.breedsViewed || 0,
        favoritesCount: todayStats?.metrics?.favoritesAdded || 0,
        totalRequests: todayStats?.metrics?.totalRequests || 0,
      },
      endpoints: {
        health: "/.netlify/functions/health",
        breeds: "/.netlify/functions/breeds",
        random: "/.netlify/functions/random",
        breedImages: "/.netlify/functions/breed-images",
        favorites: "/.netlify/functions/favorites",
        search: "/.netlify/functions/search",
        stats: "/.netlify/functions/stats",
      },
    };

    // Update request count
    if (todayStats) {
      todayStats.metrics.totalRequests += 1;
      todayStats.endpoints.health += 1;
      await todayStats.save();
    } else {
      await ServerStats.create({
        date: today,
        metrics: { totalRequests: 1 },
        endpoints: { health: 1 },
      });
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(healthData),
    };
  } catch (error) {
    console.error("Health check error:", error);

    const errorResponse = {
      status: "unhealthy",
      service: "Barkend API",
      error: "Database connection failed",
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 503,
      headers,
      body: JSON.stringify(errorResponse),
    };
  }
};
