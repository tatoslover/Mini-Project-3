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
        breedId: 1,
        name: 1,
        breed: 1,
        subBreed: 1,
        displayName: 1,
        imageCount: "$metadata.imageCount",
        lastUpdated: "$updatedAt",
      },
    });

    // Sort by display name
    pipeline.push({ $sort: { displayName: 1 } });

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
      count: results.length,
      results: results.map((result) => ({
        id: result.breedId,
        name: result.name,
        breed: result.breed,
        subBreed: result.subBreed,
        displayName: result.displayName,
        imageCount: result.imageCount || 0,
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
