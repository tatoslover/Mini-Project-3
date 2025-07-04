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

    // Try to get breeds from cache first
    let cachedBreeds = await BreedCache.find({ "metadata.isActive": true })
      .sort({ displayName: 1 })
      .lean();

    let breeds = [];
    let fromCache = false;

    if (cachedBreeds && cachedBreeds.length > 0) {
      // Use cached data
      breeds = cachedBreeds.map((breed) => ({
        id: breed.breedId,
        name: breed.name,
        breed: breed.breed,
        subBreed: breed.subBreed,
        displayName: breed.displayName,
        lastSync: breed.metadata?.externalApiLastSync,
        isActive: breed.metadata?.isActive || true,
      }));
      fromCache = true;
      console.log(`Retrieved ${breeds.length} breeds from cache`);
    } else {
      // Fetch from external API and cache
      console.log("Cache miss - fetching from Dog CEO API");
      const response = await axios.get(`${DOG_API_BASE}/breeds/list/all`);

      if (response.data && response.data.status === "success") {
        const breedsData = response.data.message;

        for (const [breed, subBreeds] of Object.entries(breedsData)) {
          if (Array.isArray(subBreeds) && subBreeds.length > 0) {
            // Handle breeds with sub-breeds
            for (const subBreed of subBreeds) {
              const breedId = `${breed}-${subBreed}`;
              const displayName = `${breed.charAt(0).toUpperCase() + breed.slice(1)} ${subBreed.charAt(0).toUpperCase() + subBreed.slice(1)}`;

              breeds.push({
                id: breedId,
                name: `${breed} ${subBreed}`,
                breed: breed,
                subBreed: subBreed,
                displayName: displayName,
                lastSync: new Date(),
                isActive: true,
              });

              // Cache in database
              await BreedCache.findOneAndUpdate(
                { breedId },
                {
                  breedId,
                  name: `${breed} ${subBreed}`,
                  breed,
                  subBreed,
                  displayName,
                  popularity: {
                    viewCount: 0,
                    favoriteCount: 0,
                    searchCount: 0,
                  },
                  metadata: {
                    externalApiLastSync: new Date(),
                    imageCount: 0,
                    isActive: true,
                  },
                },
                { upsert: true, new: true },
              );
            }
          } else {
            // Handle breeds without sub-breeds
            const breedId = breed;
            const displayName = breed.charAt(0).toUpperCase() + breed.slice(1);

            breeds.push({
              id: breedId,
              name: breed,
              breed: breed,
              subBreed: null,
              displayName: displayName,
              lastSync: new Date(),
              isActive: true,
            });

            // Cache in database
            await BreedCache.findOneAndUpdate(
              { breedId },
              {
                breedId,
                name: breed,
                breed,
                subBreed: null,
                displayName,
                popularity: {
                  viewCount: 0,
                  favoriteCount: 0,
                  searchCount: 0,
                },
                metadata: {
                  externalApiLastSync: new Date(),
                  imageCount: 0,
                  isActive: true,
                },
              },
              { upsert: true, new: true },
            );
          }
        }

        console.log(`Cached ${breeds.length} breeds to database`);
      } else {
        throw new Error("Failed to fetch breeds from Dog API");
      }
    }

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
        breedCount: breeds.length,
        fromCache,
        source: fromCache ? "cache" : "external_api",
      },
    });

    // Update daily stats
    await updateDailyStats(responseTime, "all");

    // Sort breeds alphabetically by display name
    breeds.sort((a, b) => a.displayName.localeCompare(b.displayName));

    const response = {
      success: true,
      source: fromCache ? "cache" : "external_api",
      count: breeds.length,
      data: breeds,
      metadata: {
        lastUpdated: fromCache
          ? cachedBreeds[0]?.metadata?.externalApiLastSync
          : new Date(),
        responseTime: responseTime,
        cached: fromCache,
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response, null, 2),
    };
  } catch (error) {
    console.error("Error in all breeds function:", error);

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
        source: "error",
      },
    }).catch(console.error);

    const errorResponse = {
      success: false,
      error: "Failed to retrieve external API data",
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
