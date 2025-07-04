const axios = require("axios");
const { connectToDatabase } = require("../../database/db");
const { ServerStats, ApiUsage, User } = require("../../database/models");

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
    const count = Math.min(parseInt(queryParams.count) || 1, 50); // Limit to 50 images max
    const breed = queryParams.breed; // Optional breed filter
    const simple = queryParams.simple === "true"; // Simple response with URLs only

    let images = [];

    if (breed) {
      // Normalize breed name for Dog CEO API
      const normalizedBreed = breed.toLowerCase();

      // Try different breed name formats
      const breedVariants = [
        normalizedBreed,
        normalizedBreed.replace("-", "/"),
        normalizedBreed.replace(" ", "-"),
        normalizedBreed.replace(/\s+/g, "-"),
      ];

      let breedFound = false;

      for (const breedVariant of breedVariants) {
        try {
          const promises = Array.from({ length: count }, () =>
            axios.get(`${DOG_API_BASE}/breed/${breedVariant}/images/random`),
          );

          const results = await Promise.all(promises);
          images = results
            .filter((result) => result.data.status === "success")
            .map((result, index) => ({
              url: result.data.message,
              id: `${Date.now()}_${index}`,
              breed: breedVariant,
              breedDisplayName: formatBreedName(breedVariant),
            }));

          if (images.length > 0) {
            breedFound = true;
            break;
          }
        } catch (error) {
          // Continue to next variant
          continue;
        }
      }

      if (!breedFound) {
        console.warn(`No images found for breed: ${breed}`);
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({
            success: false,
            error: `Breed '${breed}' not found`,
            message: `No images available for breed '${breed}'. Please check the breed name and try again.`,
            timestamp: new Date().toISOString(),
          }),
        };
      }
    } else {
      // Get random images from all breeds
      const promises = Array.from({ length: count }, () =>
        axios.get(`${DOG_API_BASE}/breeds/image/random`),
      );

      const results = await Promise.all(promises);
      images = results
        .filter((result) => result.data.status === "success")
        .map((result, index) => {
          const imageUrl = result.data.message;
          const extractedBreed = extractBreedFromUrl(imageUrl);

          return {
            url: imageUrl,
            id: `${Date.now()}_${index}`,
            breed: extractedBreed.breed || "unknown",
            breedDisplayName: extractedBreed.displayName || "Unknown Breed",
            subBreed: extractedBreed.subBreed || null,
          };
        });
    }

    const responseTime = Date.now() - startTime;

    // Update user stats
    await User.findOneAndUpdate(
      { userId },
      {
        $inc: {
          "stats.imagesViewed": images.length,
        },
        $set: {
          sessionId,
          "stats.lastActive": new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
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
        count: images.length,
        requestedCount: count,
        breed: breed || "any",
      },
    });

    // Update daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await ServerStats.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          "metrics.totalRequests": 1,
          "metrics.imagesServed": images.length,
          "endpoints.random": 1,
        },
        $set: {
          "metrics.averageResponseTime": responseTime,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // Return simple URLs-only response if requested
    if (simple) {
      const urls = images.map((img) => img.url);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          count: urls.length,
          data: urls,
        }),
      };
    }

    const response = {
      success: true,
      count: images.length,
      requestedCount: count,
      data: count === 1 ? images[0] : images,
      metadata: {
        responseTime: `${responseTime}ms`,
        breed: breed || "random",
        source: "Dog CEO API",
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
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
        breed: event.queryStringParameters?.breed,
      },
    }).catch(console.error);

    const errorResponse = {
      success: false,
      error: "Failed to fetch random dog images",
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

// Helper function to format breed names
function formatBreedName(breed) {
  if (!breed) return "Unknown Breed";

  return breed
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Helper function to extract breed information from image URL
function extractBreedFromUrl(url) {
  try {
    // Dog CEO API URLs follow pattern: https://images.dog.ceo/breeds/[breed]/[subbreed]/image.jpg
    const urlPath = new URL(url).pathname;
    const pathParts = urlPath.split("/");

    if (pathParts.length >= 3 && pathParts[1] === "breeds") {
      const breed = pathParts[2];
      let subBreed = null;
      let displayName = formatBreedName(breed);

      // Check if there's a sub-breed
      if (
        pathParts.length >= 4 &&
        pathParts[3] &&
        !pathParts[3].includes(".")
      ) {
        subBreed = pathParts[3];
        displayName = `${formatBreedName(breed)} ${formatBreedName(subBreed)}`;
      }

      return {
        breed: subBreed ? `${breed}-${subBreed}` : breed,
        subBreed,
        displayName,
      };
    }
  } catch (error) {
    console.warn("Failed to extract breed from URL:", url, error);
  }

  return {
    breed: "unknown",
    subBreed: null,
    displayName: "Unknown Breed",
  };
}
