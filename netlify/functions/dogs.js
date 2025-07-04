const { connectToDatabase } = require("../../database/db");
const { Dog, ServerStats, ApiUsage } = require("../../database/models");

exports.handler = async (event, context) => {
  const startTime = Date.now();

  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, x-user-id, x-session-id",
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

  let userId = null;
  let sessionId = null;

  try {
    // Connect to database
    await connectToDatabase();

    // Extract user info from headers
    userId = event.headers["x-user-id"] || "anonymous";
    sessionId = event.headers["x-session-id"] || `session_${Date.now()}`;

    // Parse the path to extract dog ID for specific operations
    const pathSegments = event.path.split("/");
    const dogId = pathSegments[pathSegments.length - 1];
    const isSpecificDog = dogId !== "dogs" && dogId.length > 0;

    const responseTime = Date.now() - startTime;

    // Route to appropriate handler based on HTTP method and path
    switch (event.httpMethod) {
      case "GET":
        if (isSpecificDog) {
          return await handleGetDogById(
            dogId,
            userId,
            sessionId,
            headers,
            responseTime,
            event,
          );
        } else {
          return await handleGetAllDogs(
            userId,
            sessionId,
            headers,
            responseTime,
            event,
          );
        }

      case "POST":
        return await handleCreateDog(
          userId,
          sessionId,
          headers,
          responseTime,
          event,
        );

      case "PUT":
        if (isSpecificDog) {
          return await handleUpdateDog(
            dogId,
            userId,
            sessionId,
            headers,
            responseTime,
            event,
          );
        } else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: "Dog ID is required for update operations",
              timestamp: new Date().toISOString(),
            }),
          };
        }

      case "DELETE":
        if (isSpecificDog) {
          return await handleDeleteDog(
            dogId,
            userId,
            sessionId,
            headers,
            responseTime,
            event,
          );
        } else {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
              success: false,
              error: "Dog ID is required for delete operations",
              timestamp: new Date().toISOString(),
            }),
          };
        }

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
    console.error("Error in dogs function:", error);

    const responseTime = Date.now() - startTime;

    // Log error
    await ApiUsage.create({
      endpoint: "/dogs",
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
      error: getOperationErrorMessage(event.httpMethod, pathSegments),
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

// Get all dogs
async function handleGetAllDogs(
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    const dogs = await Dog.find({}).sort({ createdAt: -1 }).lean();

    // Log API usage
    await ApiUsage.create({
      endpoint: "/dogs",
      method: "GET",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        count: dogs.length,
      },
    });

    // Update daily stats
    await updateDailyStats(responseTime, "dogs");

    const response = {
      success: true,
      count: dogs.length,
      data: dogs.map(formatDogResponse),
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

// Get dog by ID
async function handleGetDogById(
  dogId,
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    const dog = await Dog.findOne({ id: parseInt(dogId) }).lean();

    if (!dog) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Record not found",
          message: "The requested dog does not exist",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Log API usage
    await ApiUsage.create({
      endpoint: "/dogs",
      method: "GET",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        dogId: parseInt(dogId),
      },
    });

    // Update daily stats
    await updateDailyStats(responseTime, "dogs");

    const response = {
      success: true,
      data: formatDogResponse(dog),
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    if (isNaN(parseInt(dogId))) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Validation failed",
          message: "Invalid dog ID format",
          timestamp: new Date().toISOString(),
        }),
      };
    }
    throw error;
  }
}

// Create new dog
async function handleCreateDog(
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { name, breed, age, colour, description, imageUrl } = body;

    // Validate required fields
    if (!name || !breed) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Validation failed",
          message: "Name and breed are required",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Create new dog
    const dog = await Dog.create({
      name: name.trim(),
      breed: breed.trim(),
      age: age || undefined,
      colour: colour ? colour.trim() : undefined,
      description: description ? description.trim() : undefined,
      imageUrl: imageUrl ? imageUrl.trim() : undefined,
    });

    // Log API usage
    await ApiUsage.create({
      endpoint: "/dogs",
      method: "POST",
      userId,
      sessionId,
      responseTime,
      statusCode: 201,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        dogId: dog.id,
        breed: breed,
        action: "create_dog",
      },
    });

    // Update daily stats
    await updateDailyStats(responseTime, "dogs");

    const response = {
      success: true,
      data: formatDogResponse(dog),
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
          error: "Validation failed",
          message: "Invalid JSON in request body",
          timestamp: new Date().toISOString(),
        }),
      };
    }
    if (error.name === "ValidationError") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Failed to create record",
          message: Object.values(error.errors)
            .map((e) => e.message)
            .join(", "),
          timestamp: new Date().toISOString(),
        }),
      };
    }
    throw error;
  }
}

// Update dog
async function handleUpdateDog(
  dogId,
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    const body = JSON.parse(event.body || "{}");
    const { name, breed, age, colour, description, imageUrl } = body;

    // Build update object with only provided fields
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (breed) updateData.breed = breed.trim();
    if (age !== undefined) updateData.age = age;
    if (colour) updateData.colour = colour.trim();
    if (description) updateData.description = description.trim();
    if (imageUrl) updateData.imageUrl = imageUrl.trim();

    if (Object.keys(updateData).length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Validation failed",
          message: "No valid fields provided for update",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    const dog = await Dog.findOneAndUpdate(
      { id: parseInt(dogId) },
      updateData,
      { new: true, runValidators: true },
    ).lean();

    if (!dog) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Record not found",
          message: "The requested dog does not exist",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Log API usage
    await ApiUsage.create({
      endpoint: "/dogs",
      method: "PUT",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        dogId: parseInt(dogId),
        action: "update_dog",
        updatedFields: Object.keys(updateData),
      },
    });

    // Update daily stats
    await updateDailyStats(responseTime, "dogs");

    const response = {
      success: true,
      data: formatDogResponse(dog),
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
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
          error: "Validation failed",
          message: "Invalid JSON in request body",
          timestamp: new Date().toISOString(),
        }),
      };
    }
    if (error.name === "ValidationError") {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Failed to update record",
          message: Object.values(error.errors)
            .map((e) => e.message)
            .join(", "),
          timestamp: new Date().toISOString(),
        }),
      };
    }
    if (isNaN(parseInt(dogId))) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Validation failed",
          message: "Invalid dog ID format",
          timestamp: new Date().toISOString(),
        }),
      };
    }
    throw error;
  }
}

// Delete dog
async function handleDeleteDog(
  dogId,
  userId,
  sessionId,
  headers,
  responseTime,
  event,
) {
  try {
    const dog = await Dog.findOneAndDelete({ id: parseInt(dogId) }).lean();

    if (!dog) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Record not found",
          message: "The requested dog does not exist",
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Log API usage
    await ApiUsage.create({
      endpoint: "/dogs",
      method: "DELETE",
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers["user-agent"],
      timestamp: new Date(),
      metadata: {
        dogId: parseInt(dogId),
        action: "delete_dog",
        deletedDog: {
          name: dog.name,
          breed: dog.breed,
        },
      },
    });

    // Update daily stats
    await updateDailyStats(responseTime, "dogs");

    const response = {
      success: true,
      message: "Dog deleted successfully",
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    if (isNaN(parseInt(dogId))) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: "Validation failed",
          message: "Invalid dog ID format",
          timestamp: new Date().toISOString(),
        }),
      };
    }
    throw error;
  }
}

// Helper function to get operation-specific error messages
function getOperationErrorMessage(httpMethod, pathSegments) {
  const dogId = pathSegments[pathSegments.length - 1];
  const isSpecificDog = dogId !== "dogs" && dogId.length > 0;

  switch (httpMethod) {
    case "GET":
      return isSpecificDog
        ? "Failed to retrieve record"
        : "Failed to retrieve data";
    case "POST":
      return "Failed to create record";
    case "PUT":
      return "Failed to update record";
    case "DELETE":
      return "Failed to delete record";
    default:
      return "Failed to process database operation";
  }
}

// Helper function to format dog response
function formatDogResponse(dog) {
  return {
    id: dog.id,
    name: dog.name,
    breed: dog.breed,
    age: dog.age,
    colour: dog.colour,
    description: dog.description,
    imageUrl: dog.imageUrl,
    createdAt: dog.createdAt,
    updatedAt: dog.updatedAt,
  };
}

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
