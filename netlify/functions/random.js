const axios = require("axios");
const { connectToDatabase } = require("../../database/db");
const { ServerStats, ApiUsage, BreedCache } = require("../../database/models");

const DOG_API_BASE = "https://dog.ceo/api";

exports.handler = async (event, context) => {
  const startTime = Date.now();

  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-session-id",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

  let userId = null;
  let sessionId = null;

  try {
    // Connect to database
    await connectToDatabase();

    // Extract user info from headers
    userId = event.headers["x-user-id"] || "anonymous";
    sessionId = event.headers["x-session-id"] || `session_${Date.now()}`;

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const breed = queryParams.breed;
    const count = Math.min(parseInt(queryParams.count) || 3, 20); // Default 3, max 20

    // Validate breed parameter
    if (!breed) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Breed parameter is required",
          message: "Please provide a breed name in the query parameter",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Format breed name for API call
    const formattedBreed = breed.toLowerCase().replace(/\s+/g, "/");

    try {
      // Get breed images from Dog CEO API
      const response = await axios.get(
        `${DOG_API_BASE}/breed/${formattedBreed}/images`,
      );

      if (response.data.status !== "success") {
        throw new Error("Failed to fetch breed images");
      }

      // Get all images for the breed
      const allImages = response.data.message;

      if (allImages.length === 0) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: "No images found for this breed",
            breed: breed,
            timestamp: new Date().toISOString(),
          }),
        };
      }

      // Randomly select the requested number of images
      const selectedImages = [];
      const shuffledImages = [...allImages].sort(() => 0.5 - Math.random());

      for (let i = 0; i < Math.min(count, shuffledImages.length); i++) {
        selectedImages.push({
          url: shuffledImages[i],
          verified: true,
        });
      }

      const responseTime = Date.now() - startTime;

      // Update breed popularity in cache
      await BreedCache.findOneAndUpdate(
        {
          $or: [
            { breed: breed.toLowerCase() },
            { displayName: { $regex: new RegExp(breed, "i") } },
          ],
        },
        {
          $inc: { "popularity.viewCount": 1 },
          $set: { "metadata.externalApiLastSync": new Date() },
        },
      );

      // Log API usage
      await ApiUsage.create({
        endpoint: "/random",
        method: "GET",
        userId,
        sessionId,
        responseTime,
        statusCode: 200,
        userAgent: event.headers["user-agent"],
        timestamp: new Date(),
        metadata: {
          breed: breed,
          imagesRequested: count,
          imagesReturned: selectedImages.length,
          totalAvailable: allImages.length,
        },
      });

      // Update daily stats
      await updateDailyStats(responseTime, "random");

      const response_data = {
        success: true,
        breed: breed,
        count: selectedImages.length,
        totalAvailable: allImages.length,
        data: selectedImages,
        timestamp: new Date().toISOString(),
      };

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response_data, null, 2),
      };
    } catch (error) {
      // Handle breed not found or API errors
      if (error.response && error.response.status === 404) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: "Breed not found",
            message: `The breed "${breed}" was not found. Please check the spelling or try a different breed.`,
            breed: breed,
            timestamp: new Date().toISOString(),
          }),
        };
      }

      throw error; // Re-throw other errors to be handled by outer catch
    }
  } catch (error) {
    console.error("Error in random function:", error);

    const responseTime = Date.now() - startTime;

    // Log error
    await ApiUsage.create({
      endpoint: "/random",
      method: "GET",
      userId,
      sessionId,
      responseTime,
      statusCode: 500,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        error: error.message,
        breed: event.queryStringParameters?.breed || "unknown",
      },
    }).catch(console.error);

    const errorResponse = {
      success: false,
      error: "Failed to retrieve breed images",
      message: error.message,
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse),
    };
  }
};

// Helper function to update daily stats
async function updateDailyStats(responseTime, endpoint) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await ServerStats.findOneAndUpdate(
    { date: today },
    {
      $inc: {
        "metrics.totalRequests": 1,
        "metrics.imagesServed": 1,
        [`endpoints.${endpoint}`]: 1,
      },
      $set: {
        "metrics.averageResponseTime": responseTime,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true },
  );
}
