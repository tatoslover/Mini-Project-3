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
    const searchQuery = queryParams.q;
    const limit = Math.min(parseInt(queryParams.limit) || 10, 50);
    const sortBy = queryParams.sortBy || "name";

    // Validate required parameters
    if (!searchQuery || searchQuery.trim().length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Search query (q) parameter is required",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Connect to database
    await connectToDatabase();

    // Build search aggregation pipeline
    let pipeline = [];

    // Text search stage
    pipeline.push({
      $match: {
        $and: [
          { "metadata.isActive": true },
          {
            $or: [
              { name: { $regex: searchQuery, $options: "i" } },
              { breed: { $regex: searchQuery, $options: "i" } },
              { displayName: { $regex: searchQuery, $options: "i" } },
              { subBreed: { $regex: searchQuery, $options: "i" } },
            ],
          },
        ],
      },
    });

    // Add calculated fields for relevance and formatting
    pipeline.push({
      $addFields: {
        relevanceScore: {
          $add: [
            // Exact match bonus
            { $cond: [{ $eq: ["$breed", searchQuery.toLowerCase()] }, 1.0, 0] },
            // Starts with bonus
            {
              $cond: [
                {
                  $regexMatch: {
                    input: "$breed",
                    regex: `^${searchQuery}`,
                    options: "i",
                  },
                },
                0.8,
                0,
              ],
            },
            // Contains bonus
            {
              $cond: [
                {
                  $regexMatch: {
                    input: "$breed",
                    regex: searchQuery,
                    options: "i",
                  },
                },
                0.5,
                0,
              ],
            },
            // Display name bonus
            {
              $cond: [
                {
                  $regexMatch: {
                    input: "$displayName",
                    regex: searchQuery,
                    options: "i",
                  },
                },
                0.3,
                0,
              ],
            },
            // Popularity bonus (normalized)
            { $divide: ["$popularity.viewCount", 1000] },
          ],
        },
        subBreedsArray: {
          $cond: [
            {
              $and: [{ $ne: ["$subBreed", null] }, { $ne: ["$subBreed", ""] }],
            },
            ["$subBreed"],
            [],
          ],
        },
      },
    });

    // Project final fields
    pipeline.push({
      $project: {
        breed: 1,
        displayName: 1,
        subBreeds: "$subBreedsArray",
        popularity: "$popularity.viewCount",
        imageCount: "$metadata.imageCount",
        relevanceScore: 1,
        lastUpdated: "$updatedAt",
      },
    });

    // Sort based on sortBy parameter
    let sortStage = {};
    switch (sortBy) {
      case "relevance":
        sortStage = { relevanceScore: -1, popularity: -1, displayName: 1 };
        break;
      case "popularity":
        sortStage = { popularity: -1, displayName: 1 };
        break;
      case "name":
      default:
        sortStage = { displayName: 1 };
        break;
    }
    pipeline.push({ $sort: sortStage });

    // Limit results
    pipeline.push({ $limit: limit });

    // Execute search
    const startTime = Date.now();
    const results = await BreedCache.aggregate(pipeline);
    const searchTime = Date.now() - startTime;

    // Format response
    const searchResponse = {
      success: true,
      query: searchQuery,
      sortBy,
      count: results.length,
      searchTime: `${searchTime}ms`,
      results: results.map((result) => ({
        breed: result.breed,
        displayName: result.displayName,
        subBreeds: result.subBreeds || [],
      })),
      timestamp: new Date().toISOString(),
    };

    // Log the search request
    try {
      await new ApiUsage({
        endpoint: "/search",
        method: "GET",
        responseTime: searchTime,
        statusCode: 200,
        userAgent: event.headers["user-agent"],
        metadata: {
          searchQuery,
          resultCount: results.length,
          sortBy,
        },
        timestamp: new Date(),
      }).save();
    } catch (logError) {
      console.warn("Failed to log API usage:", logError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(searchResponse, null, 2),
    };
  } catch (error) {
    console.error("Error in search function:", error);

    const errorResponse = {
      success: false,
      error: "Search failed",
      message: error.message,
      query: event.queryStringParameters?.q || "",
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse),
    };
  }
};
