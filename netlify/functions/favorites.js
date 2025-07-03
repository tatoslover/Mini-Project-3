const { connectToDatabase } = require("../../database/db");
const {
  FavoriteImage,
  ServerStats,
  ApiUsage,
  User,
} = require("../../database/models");

exports.handler = async (event, context) => {
  const startTime = Date.now();

  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-session-id",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
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

  let userId = null;
  let sessionId = null;

  try {
    // Connect to database
    await connectToDatabase();

    // Extract user info from headers
    userId = event.headers["x-user-id"] || "anonymous";
    sessionId = event.headers["x-session-id"] || `session_${Date.now()}`;

    const responseTime = Date.now() - startTime;

    // Handle different HTTP methods
    switch (event.httpMethod) {
      case "GET":
        return await handleGetFavorites(
          userId,
          sessionId,
          headers,
          responseTime,
          event,
        );

      case "POST":
        return await handleAddFavorite(
          userId,
          sessionId,
          headers,
          responseTime,
          event,
        );

      case "DELETE":
        return await handleDeleteFavorite(
          userId,
          sessionId,
          headers,
          responseTime,
          event,
        );

      default:
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
  } catch (error) {
    console.error("Error in favorites function:", error);

    const responseTime = Date.now() - startTime;

    // Log error
    await ApiUsage.create({
      endpoint: "/favorites",
      method: event.httpMethod,
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
      error: "Internal server error",
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

// Get all favorites for a user
async function handleGetFavorites(
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    const favorites = await FavoriteImage.find({ userId })
      .sort({ addedAt: -1 })
      .lean();

    // Log API usage
    await ApiUsage.create({
      endpoint: "/favorites",
      method: "GET",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        count: favorites.length,
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
          "endpoints.favorites": 1,
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
      count: favorites.length,
      data: favorites.map((fav) => ({
        id: fav._id,
        url: fav.imageUrl,
        breed: fav.breed,
        breedDisplayName: fav.breedDisplayName,
        subBreed: fav.subBreed,
        tags: fav.tags,
        notes: fav.notes,
        addedAt: fav.addedAt,
      })),
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    throw error;
  }
}

// Add a new favorite
async function handleAddFavorite(
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { url, breed, name, subBreed, tags, notes } = body;

    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Image URL is required",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Check if already favorited
    const existingFavorite = await FavoriteImage.findOne({
      userId,
      imageUrl: url,
    });
    if (existingFavorite) {
      return {
        statusCode: 409,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Image already in favorites",
          data: {
            id: existingFavorite._id,
            addedAt: existingFavorite.addedAt,
          },
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Create new favorite
    const favorite = await FavoriteImage.create({
      userId,
      imageUrl: url,
      breed: breed || "unknown",
      breedDisplayName: name || "Unknown Breed",
      subBreed: subBreed || null,
      tags: tags || [],
      notes: notes || "",
      addedAt: new Date(),
    });

    // Update user preferences
    await User.findOneAndUpdate(
      { userId },
      {
        $addToSet: {
          "preferences.favoriteBreeds": breed,
        },
        $inc: {
          "stats.imagesViewed": 1,
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
      endpoint: "/favorites",
      method: "POST",
      userId,
      sessionId,
      responseTime,
      statusCode: 201,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        breed: breed,
        action: "add_favorite",
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
          "metrics.favoritesAdded": 1,
          "endpoints.favorites": 1,
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
      message: "Added to favorites",
      data: {
        id: favorite._id,
        url: favorite.imageUrl,
        breed: favorite.breed,
        breedDisplayName: favorite.breedDisplayName,
        subBreed: favorite.subBreed,
        tags: favorite.tags,
        notes: favorite.notes,
        addedAt: favorite.addedAt,
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          timestamp: new Date().toISOString(),
        }),
      };
    }
    throw error;
  }
}

// Delete a favorite
async function handleDeleteFavorite(
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    // Extract favorite ID from path
    const pathSegments = event.path.split("/");
    const favoriteId = pathSegments[pathSegments.length - 1];

    if (!favoriteId || favoriteId === "favorites") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Favorite ID is required",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Find and delete the favorite
    const deletedFavorite = await FavoriteImage.findOneAndDelete({
      _id: favoriteId,
      userId: userId, // Ensure user can only delete their own favorites
    });

    if (!deletedFavorite) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Favorite not found or access denied",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Log API usage
    await ApiUsage.create({
      endpoint: "/favorites",
      method: "DELETE",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        favoriteId: favoriteId,
        breed: deletedFavorite.breed,
        action: "remove_favorite",
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
          "endpoints.favorites": 1,
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
      message: "Removed from favorites",
      data: {
        id: deletedFavorite._id,
        url: deletedFavorite.imageUrl,
        breed: deletedFavorite.breed,
        breedDisplayName: deletedFavorite.breedDisplayName,
        addedAt: deletedFavorite.addedAt,
      },
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    throw error;
  }
}
