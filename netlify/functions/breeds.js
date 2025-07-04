const axios = require("axios");
const { connectToDatabase } = require("../../database/db");
const { BreedCache, ServerStats, ApiUsage } = require("../../database/models");

const DOG_API_BASE = "https://dog.ceo/api";

exports.handler = async (event, context) => {
  const startTime = Date.now();

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

  let userId = null;
  let sessionId = null;

  try {
    // Connect to database
    await connectToDatabase();

    // Extract user info from headers
    userId = event.headers["x-user-id"] || "anonymous";
    sessionId = event.headers["x-session-id"] || `session_${Date.now()}`;

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

      console.log(`Using cached breed data: ${breeds.length} breeds`);
    } else {
      // Fetch from external API and cache
      console.log("Fetching breeds from Dog CEO API...");
      const response = await axios.get(`${DOG_API_BASE}/breeds/list/all`);

      if (response.data.status === "success") {
        const breedData = response.data.message;

        // Transform and cache breeds
        for (const [breed, subBreeds] of Object.entries(breedData)) {
          if (subBreeds.length > 0) {
            for (const subBreed of subBreeds) {
              const breedId = `${breed}-${subBreed}`;
              const displayName = `${breed.charAt(0).toUpperCase() + breed.slice(1)} ${subBreed.charAt(0).toUpperCase() + subBreed.slice(1)}`;

              breeds.push({
                id: breedId,
                breed: breed,
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
                  metadata: {
                    externalApiLastSync: new Date(),
                    isActive: true,
                  },
                },
                { upsert: true, new: true },
              );
            }
          } else {
            const breedId = breed;
            const displayName = breed.charAt(0).toUpperCase() + breed.slice(1);

            breeds.push({
              id: breedId,
              breed: breed,
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
                metadata: {
                  externalApiLastSync: new Date(),
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
      endpoint: "/breeds",
      method: "GET",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        count: breeds.length,
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
          "metrics.breedsViewed": 1,
          "endpoints.breeds": 1,
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
      count: breeds.length,
      data: breeds,
      metadata: {
        cached: cachedBreeds.length > 0,
        responseTime: `${responseTime}ms`,
        lastUpdated:
          cachedBreeds.length > 0
            ? cachedBreeds[0]?.metadata?.externalApiLastSync
            : new Date(),
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error in breeds function:", error);

    const responseTime = Date.now() - startTime;

    // Log error
    await ApiUsage.create({
      endpoint: "/breeds",
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
      error: "Failed to fetch dog breeds",
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
