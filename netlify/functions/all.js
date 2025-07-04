const axios = require("axios");
const { connectToDatabase } = require("../../database/db");
const { BreedCache, ServerStats, ApiUsage } = require("../../database/models");

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

    // Get all breeds data
    const breedsData = await getAllBreeds();

    // Get popular breeds data
    const popularBreedsData = await getPopularBreeds();

    // Get sample random images
    const randomImagesData = await getRandomImages();

    // Get system statistics
    const systemStatsData = await getSystemStats();

    const responseTime = Date.now() - startTime;

    // Log API usage
    await ApiUsage.create({
      endpoint: "/all",
      method: "GET",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        breedsCount: breedsData?.count || 0,
        popularBreedsCount: popularBreedsData?.count || 0,
        randomImagesCount: randomImagesData?.count || 0,
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
          "endpoints.all": 1,
        },
        $set: {
          "metrics.averageResponseTime": responseTime,
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    const response = {
      success: true,
      breeds: breedsData,
      popularBreeds: popularBreedsData,
      randomImages: randomImagesData,
      systemStats: systemStatsData,
      metadata: {
        responseTime: `${responseTime}ms`,
        dataFreshness: "live",
        includedEndpoints: ["/breeds", "/breeds-popular", "/random", "/stats"],
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error in all function:", error);

    const responseTime = Date.now() - startTime;

    // Log error
    await ApiUsage.create({
      endpoint: "/all",
      method: "GET",
      userId,
      sessionId,
      responseTime,
      statusCode: 500,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        error: error.message,
      },
    }).catch(console.error);

    const errorResponse = {
      success: false,
      error: "Failed to fetch comprehensive API data",
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

// Helper function to get all breeds
async function getAllBreeds() {
  try {
    // Check if we have cached breed data
    const cachedBreeds = await BreedCache.find({ "metadata.isActive": true })
      .sort({ breed: 1, subBreed: 1 })
      .lean();

    let breeds = [];

    if (cachedBreeds.length > 0) {
      // Use cached data
      breeds = cachedBreeds.map((breed) => ({
        id: breed.breedId,
        breed: breed.breed,
      }));
    } else {
      // Fetch from external API
      const response = await axios.get(`${DOG_API_BASE}/breeds/list/all`);

      if (response.data.status === "success") {
        const breedData = response.data.message;

        for (const [breed, subBreeds] of Object.entries(breedData)) {
          if (subBreeds.length > 0) {
            for (const subBreed of subBreeds) {
              breeds.push({
                id: `${breed}-${subBreed}`,
                breed: breed,
              });
            }
          } else {
            breeds.push({
              id: breed,
              breed: breed,
            });
          }
        }
      }
    }

    return {
      success: true,
      count: breeds.length,
      data: breeds,
    };
  } catch (error) {
    console.error("Error getting breeds:", error);
    return {
      success: false,
      count: 0,
      data: [],
      error: error.message,
    };
  }
}

// Helper function to get popular breeds
async function getPopularBreeds() {
  try {
    const limit = 10;
    const timeframe = "week";

    // Calculate date range
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const dateFilter = { timestamp: { $gte: weekAgo } };

    // Get breed popularity from API usage data
    const popularityData = await ApiUsage.aggregate([
      {
        $match: {
          ...dateFilter,
          "metadata.breed": { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$metadata.breed",
          viewCount: { $sum: 1 },
          searchCount: {
            $sum: {
              $cond: [{ $eq: ["$endpoint", "/search"] }, 1, 0],
            },
          },
          lastViewed: { $max: "$timestamp" },
        },
      },
      { $sort: { viewCount: -1 } },
      { $limit: limit },
    ]);

    // Get breed details
    const breeds = await Promise.all(
      popularityData.map(async (pop, index) => {
        const breedData = await BreedCache.findOne({
          breed: pop._id,
          "metadata.isActive": true,
        });

        if (!breedData) return null;

        // Calculate popularity score
        const maxViews = popularityData[0]?.viewCount || 1;
        const popularityScore = Math.round((pop.viewCount / maxViews) * 100);

        return {
          rank: index + 1,
          breed: breedData.breed,
          viewCount: pop.viewCount,
          searchCount: pop.searchCount,
          popularityScore,
          lastViewed: pop.lastViewed,
        };
      }),
    );

    const filteredBreeds = breeds.filter((breed) => breed !== null);

    return {
      success: true,
      timeframe,
      count: filteredBreeds.length,
      data: filteredBreeds,
    };
  } catch (error) {
    console.error("Error getting popular breeds:", error);
    return {
      success: false,
      timeframe: "week",
      count: 0,
      data: [],
      error: error.message,
    };
  }
}

// Helper function to get random images
async function getRandomImages() {
  try {
    const count = 5; // Get 5 random images

    const promises = Array.from({ length: count }, () =>
      axios.get(`${DOG_API_BASE}/breeds/image/random`),
    );

    const results = await Promise.all(promises);
    const images = results
      .filter((result) => result.data.status === "success")
      .map((result, index) => {
        const imageUrl = result.data.message;
        const extractedBreed = extractBreedFromUrl(imageUrl);

        return {
          url: imageUrl,
          id: `${Date.now()}_${index}`,
          breed: extractedBreed.breed || "unknown",
          breedDisplayName: extractedBreed.displayName || "Unknown Breed",
        };
      });

    return {
      success: true,
      count: images.length,
      data: images,
    };
  } catch (error) {
    console.error("Error getting random images:", error);
    return {
      success: false,
      count: 0,
      data: [],
      error: error.message,
    };
  }
}

// Helper function to get system stats
async function getSystemStats() {
  try {
    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayStats = await ServerStats.findOne({ date: today });

    // Get recent API usage
    const recentUsage = await ApiUsage.aggregate([
      {
        $match: {
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          averageResponseTime: { $avg: "$responseTime" },
        },
      },
    ]);

    const stats = {
      imagesServed: todayStats?.metrics?.imagesServed || 0,
      breedsViewed: todayStats?.metrics?.breedsViewed || 0,
      apiRequests: recentUsage[0]?.totalRequests || 0,
      averageResponseTime: Math.round(
        recentUsage[0]?.averageResponseTime || 0,
      ),
    };

    return {
      success: true,
      data: stats,
    };
  } catch (error) {
    console.error("Error getting system stats:", error);
    return {
      success: false,
      data: {
        imagesServed: 0,
        breedsViewed: 0,
        apiRequests: 0,
        averageResponseTime: 0,
      },
      error: error.message,
    };
  }
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

// Helper function to format breed names
function formatBreedName(breed) {
  if (!breed) return "Unknown Breed";

  return breed
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
