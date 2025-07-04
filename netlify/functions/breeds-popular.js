const { connectToDatabase } = require("../../database/db");
const { BreedCache, ApiUsage } = require("../../database/models");

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
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

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const limit = Math.min(parseInt(queryParams.limit) || 10, 20);
    const timeframe = queryParams.timeframe || "week";

    // Connect to database
    await connectToDatabase();

    // Calculate date range based on timeframe
    let dateFilter = {};
    const now = new Date();

    switch (timeframe) {
      case "today":
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        dateFilter = { timestamp: { $gte: today } };
        break;
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = { timestamp: { $gte: weekAgo } };
        break;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        dateFilter = { timestamp: { $gte: monthAgo } };
        break;
      case "all":
      default:
        dateFilter = {};
        break;
    }

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
          avgResponseTime: { $avg: "$responseTime" },
          lastViewed: { $max: "$timestamp" },
        },
      },
      { $sort: { viewCount: -1 } },
      { $limit: limit * 2 }, // Get more to account for inactive breeds
    ]);

    // Get breed details and calculate popularity scores
    const breedPromises = popularityData.map(async (pop, index) => {
      const breedData = await BreedCache.findOne({
        breed: pop._id,
        "metadata.isActive": true,
      });

      if (!breedData) return null;

      // Calculate popularity score (0-100)
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
    });

    // Wait for all breed data and filter out nulls
    const breeds = (await Promise.all(breedPromises))
      .filter((breed) => breed !== null)
      .slice(0, limit);

    // Re-assign ranks after filtering
    breeds.forEach((breed, index) => {
      breed.rank = index + 1;
    });

    const response = {
      success: true,
      timeframe,
      count: breeds.length,
      data: breeds,
      metadata: {
        totalAnalyzed: popularityData.length,
        dateRange: {
          from:
            timeframe === "all"
              ? "beginning"
              : new Date(
                  now.getTime() - getTimeframeMs(timeframe),
                ).toISOString(),
          to: now.toISOString(),
        },
      },
      timestamp: new Date().toISOString(),
    };

    // Log the request
    try {
      await new ApiUsage({
        endpoint: "/breeds/popular",
        method: "GET",
        responseTime: Date.now() - context.callbackWaitsForEmptyEventLoop,
        statusCode: 200,
        userAgent: event.headers["user-agent"],
        metadata: {
          timeframe,
          limit,
          resultCount: breeds.length,
        },
        timestamp: new Date(),
      }).save();
    } catch (logError) {
      console.warn("Failed to log API usage:", logError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response, null, 2),
    };
  } catch (error) {
    console.error("Error in breeds-popular function:", error);

    const errorResponse = {
      success: false,
      error: "Failed to retrieve popular breeds",
      message: error.message,
      timeframe: event.queryStringParameters?.timeframe || "week",
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse),
    };
  }
};

// Helper function to get timeframe in milliseconds
function getTimeframeMs(timeframe) {
  switch (timeframe) {
    case "today":
      return 24 * 60 * 60 * 1000;
    case "week":
      return 7 * 24 * 60 * 60 * 1000;
    case "month":
      return 30 * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}
