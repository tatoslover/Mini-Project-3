const fs = require("fs");
const path = require("path");

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
    // Load the swagger specification
    const swaggerPath = path.join(process.cwd(), "swagger", "swagger.json");
    let swaggerSpec;

    try {
      const swaggerContent = fs.readFileSync(swaggerPath, "utf8");
      swaggerSpec = JSON.parse(swaggerContent);
    } catch (fileError) {
      // If file doesn't exist, return a basic spec
      swaggerSpec = {
        openapi: "3.0.0",
        info: {
          title: "Barkend API",
          version: "1.0.0",
          description:
            "A comprehensive RESTful API for dog breed information and images",
          contact: {
            name: "Barkend Team",
          },
        },
        servers: [
          {
            url:
              event.headers["x-forwarded-proto"] + "://" + event.headers.host,
            description: "Production server",
          },
        ],
        paths: {
          "/.netlify/functions/health": {
            get: {
              summary: "Health Check",
              description: "Returns the health status of the API server",
              tags: ["System"],
              responses: {
                200: {
                  description: "Server is healthy",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          status: { type: "string", example: "healthy" },
                          service: { type: "string", example: "Barkend API" },
                          version: { type: "string", example: "1.0.0" },
                          database: {
                            type: "object",
                            properties: {
                              status: { type: "string", example: "connected" },
                              type: {
                                type: "string",
                                example: "MongoDB Atlas",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "/.netlify/functions/breeds": {
            get: {
              summary: "Get All Breeds",
              description: "Retrieves all available dog breeds with sub-breeds",
              tags: ["Breeds"],
              responses: {
                200: {
                  description: "List of all dog breeds",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          count: { type: "integer", example: 98 },
                          data: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                id: {
                                  type: "string",
                                  example: "affenpinscher",
                                },
                                name: {
                                  type: "string",
                                  example: "affenpinscher",
                                },
                                breed: {
                                  type: "string",
                                  example: "affenpinscher",
                                },
                                subBreed: { type: "string", nullable: true },
                                displayName: {
                                  type: "string",
                                  example: "Affenpinscher",
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "/.netlify/functions/random": {
            get: {
              summary: "Get Random Dog Images",
              description: "Returns random dog images from various breeds",
              tags: ["Images"],
              parameters: [
                {
                  name: "count",
                  in: "query",
                  description: "Number of images to return (max 50)",
                  required: false,
                  schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 50,
                    default: 1,
                  },
                },
                {
                  name: "breed",
                  in: "query",
                  description: "Specific breed to get random images from",
                  required: false,
                  schema: {
                    type: "string",
                  },
                },
              ],
              responses: {
                200: {
                  description: "Random dog images",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          count: { type: "integer", example: 1 },
                          data: {
                            type: "object",
                            properties: {
                              url: { type: "string", format: "uri" },
                              id: { type: "string" },
                              breed: { type: "string" },
                              breedDisplayName: { type: "string" },
                              timestamp: {
                                type: "string",
                                format: "date-time",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          "/.netlify/functions/favorites": {
            get: {
              summary: "Get Favorites",
              description: "Returns all favorite dog images for the user",
              tags: ["Favorites"],
              parameters: [
                {
                  name: "x-user-id",
                  in: "header",
                  description: "User identifier",
                  required: false,
                  schema: { type: "string" },
                },
              ],
              responses: {
                200: {
                  description: "List of favorite images",
                },
              },
            },
            post: {
              summary: "Add Favorite",
              description: "Adds a dog image to favorites",
              tags: ["Favorites"],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["url"],
                      properties: {
                        url: { type: "string", format: "uri" },
                        breed: { type: "string" },
                        name: { type: "string" },
                        subBreed: { type: "string" },
                        tags: { type: "array", items: { type: "string" } },
                        notes: { type: "string" },
                      },
                    },
                  },
                },
              },
              responses: {
                201: {
                  description: "Favorite added successfully",
                },
              },
            },
          },
          "/.netlify/functions/stats": {
            get: {
              summary: "Get Statistics",
              description: "Returns server statistics and usage metrics",
              tags: ["System"],
              parameters: [
                {
                  name: "timeframe",
                  in: "query",
                  description: "Time period for statistics",
                  required: false,
                  schema: {
                    type: "string",
                    enum: ["today", "week", "month", "all"],
                    default: "today",
                  },
                },
                {
                  name: "detailed",
                  in: "query",
                  description: "Include detailed analytics",
                  required: false,
                  schema: {
                    type: "boolean",
                    default: false,
                  },
                },
              ],
              responses: {
                200: {
                  description: "Server statistics",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          timeframe: { type: "string", example: "today" },
                          data: {
                            type: "object",
                            properties: {
                              overview: {
                                type: "object",
                                properties: {
                                  totalRequests: { type: "integer" },
                                  uniqueUsers: { type: "integer" },
                                  imagesServed: { type: "integer" },
                                  breedsViewed: { type: "integer" },
                                  favoritesAdded: { type: "integer" },
                                  totalBreeds: { type: "integer" },
                                },
                              },
                              performance: {
                                type: "object",
                                properties: {
                                  averageResponseTime: { type: "integer" },
                                  uptime: {
                                    type: "object",
                                    properties: {
                                      display: { type: "string" },
                                      hours: { type: "integer" },
                                      minutes: { type: "integer" },
                                      seconds: { type: "integer" },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        tags: [
          {
            name: "System",
            description: "System health and monitoring endpoints",
          },
          {
            name: "Breeds",
            description: "Dog breed information and search",
          },
          {
            name: "Images",
            description: "Dog image retrieval endpoints",
          },
          {
            name: "Favorites",
            description: "Favorite dog images management",
          },
        ],
      };
    }

    // Update server URL to match current environment
    if (swaggerSpec.servers) {
      swaggerSpec.servers[0].url =
        event.headers["x-forwarded-proto"] + "://" + event.headers.host;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(swaggerSpec, null, 2),
    };
  } catch (error) {
    console.error("Error in swagger-spec function:", error);

    const errorResponse = {
      success: false,
      error: "Failed to retrieve API specification",
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
