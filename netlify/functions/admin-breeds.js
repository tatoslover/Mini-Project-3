const connectToDatabase = require("../../database/db");
const { BreedCache, ApiUsage } = require("../../database/models");

// Admin authentication removed for easier access

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

  // Admin authentication removed - open access for demo purposes

  try {
    // Connect to database
    await connectToDatabase();

    switch (event.httpMethod) {
      case "GET":
        return await handleGet(event);
      case "POST":
        return await handlePost(event);
      case "PUT":
        return await handlePut(event);
      case "DELETE":
        return await handleDelete(event);
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
    console.error("Error in admin-breeds function:", error);

    const errorResponse = {
      success: false,
      error: "Admin operation failed",
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

// GET - Retrieve all breeds
async function handleGet(event) {
  const queryParams = event.queryStringParameters || {};
  const limit = Math.min(parseInt(queryParams.limit) || 50, 100);
  const includeInactive = queryParams.includeInactive === "true";

  const filter = includeInactive ? {} : { "metadata.isActive": true };

  const breeds = await BreedCache.find(filter)
    .select({
      breedId: 1,
      breed: 1,
      displayName: 1,
      subBreed: 1,
      "metadata.imageCount": 1,
      "metadata.isActive": 1,
      "metadata.externalApiLastSync": 1,
      "popularity.viewCount": 1,
      "popularity.searchCount": 1,
      createdAt: 1,
      updatedAt: 1,
    })
    .sort({ "popularity.viewCount": -1 })
    .limit(limit);

  const totalCount = await BreedCache.countDocuments(filter);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      {
        success: true,
        count: breeds.length,
        totalCount,
        includeInactive,
        data: breeds,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  };
}

// POST - Create new breed
async function handlePost(event) {
  let breedData;
  try {
    breedData = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "Invalid JSON in request body",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Validate required fields
  if (!breedData.breed || !breedData.displayName) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "breed and displayName are required fields",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Check if breed already exists
  const existingBreed = await BreedCache.findOne({
    breed: breedData.breed.toLowerCase(),
  });
  if (existingBreed) {
    return {
      statusCode: 409,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "Breed already exists",
        existingBreed: existingBreed.breed,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Create new breed
  const newBreed = new BreedCache({
    breedId: breedData.breed.toLowerCase(),
    breed: breedData.breed.toLowerCase(),
    displayName: breedData.displayName,
    subBreed: breedData.subBreed || null,
    images: [],
    popularity: {
      viewCount: 0,
      favoriteCount: 0,
      searchCount: 0,
    },
    metadata: {
      imageCount: 0,
      isActive: breedData.isActive !== false,
      externalApiLastSync: new Date(),
    },
  });

  await newBreed.save();

  // Log the admin action
  await new ApiUsage({
    endpoint: "/admin/breeds",
    method: "POST",
    responseTime: 0,
    statusCode: 201,
    metadata: {
      action: "create_breed",
      breed: breedData.breed.toLowerCase(),
    },
    timestamp: new Date(),
  }).save();

  return {
    statusCode: 201,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      {
        success: true,
        message: "Breed created successfully",
        data: {
          breedId: newBreed.breedId,
          breed: newBreed.breed,
          displayName: newBreed.displayName,
          isActive: newBreed.metadata.isActive,
        },
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  };
}

// PUT - Update existing breed
async function handlePut(event) {
  let updateData;
  try {
    updateData = JSON.parse(event.body);
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "Invalid JSON in request body",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  if (!updateData.breed) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "breed field is required",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Find and update breed
  const breed = await BreedCache.findOne({
    breed: updateData.breed.toLowerCase(),
  });
  if (!breed) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "Breed not found",
        breed: updateData.breed,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Update fields
  if (updateData.displayName) breed.displayName = updateData.displayName;
  if (updateData.subBreed !== undefined) breed.subBreed = updateData.subBreed;
  if (updateData.description) breed.description = updateData.description;
  if (updateData.isActive !== undefined)
    breed.metadata.isActive = updateData.isActive;

  await breed.save();

  // Log the admin action
  await new ApiUsage({
    endpoint: "/admin/breeds",
    method: "PUT",
    responseTime: 0,
    statusCode: 200,
    metadata: {
      action: "update_breed",
      breed: updateData.breed.toLowerCase(),
    },
    timestamp: new Date(),
  }).save();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      {
        success: true,
        message: "Breed updated successfully",
        data: {
          breed: breed.breed,
          displayName: breed.displayName,
          subBreed: breed.subBreed,
          isActive: breed.metadata.isActive,
          lastUpdated: breed.updatedAt,
        },
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  };
}

// DELETE - Remove breed
async function handleDelete(event) {
  const queryParams = event.queryStringParameters || {};
  const breedToDelete = queryParams.breed;

  if (!breedToDelete) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "breed query parameter is required",
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Find breed
  const breed = await BreedCache.findOne({
    breed: breedToDelete.toLowerCase(),
  });
  if (!breed) {
    return {
      statusCode: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: "Breed not found",
        breed: breedToDelete,
        timestamp: new Date().toISOString(),
      }),
    };
  }

  // Soft delete - mark as inactive instead of removing
  breed.metadata.isActive = false;
  await breed.save();

  // Log the admin action
  await new ApiUsage({
    endpoint: "/admin/breeds",
    method: "DELETE",
    responseTime: 0,
    statusCode: 200,
    metadata: {
      action: "delete_breed",
      breed: breedToDelete.toLowerCase(),
    },
    timestamp: new Date(),
  }).save();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      {
        success: true,
        message: "Breed deactivated successfully",
        data: {
          breed: breed.breed,
          displayName: breed.displayName,
          isActive: breed.metadata.isActive,
          deletedAt: new Date(),
        },
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ),
  };
}
