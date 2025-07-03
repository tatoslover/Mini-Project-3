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
          "/.netlify/functions/cache-status": {
            get: {
              summary: "Get Cache Status",
              description:
                "Returns cache health, statistics, and performance metrics",
              tags: ["Cache Management"],
              responses: {
                200: {
                  description: "Cache status and statistics",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          status: { type: "string", example: "healthy" },
                          data: {
                            type: "object",
                            properties: {
                              totalBreeds: { type: "integer", example: 98 },
                              cachedImages: { type: "integer", example: 1247 },
                              cacheHitRate: { type: "number", example: 95.2 },
                              lastSync: { type: "string", format: "date-time" },
                              storage: {
                                type: "object",
                                properties: {
                                  size: { type: "string", example: "45.2 MB" },
                                  usage: { type: "number", example: 78.5 },
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
          "/.netlify/functions/search": {
            get: {
              summary: "Search Breeds",
              description:
                "Search dog breeds by name, characteristics, or popularity",
              tags: ["Search & Discovery"],
              parameters: [
                {
                  name: "q",
                  in: "query",
                  description: "Search query",
                  required: true,
                  schema: { type: "string" },
                },
                {
                  name: "limit",
                  in: "query",
                  description: "Maximum number of results",
                  required: false,
                  schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 50,
                    default: 10,
                  },
                },
                {
                  name: "sortBy",
                  in: "query",
                  description: "Sort results by field",
                  required: false,
                  schema: {
                    type: "string",
                    enum: ["name", "popularity", "relevance"],
                    default: "relevance",
                  },
                },
              ],
              responses: {
                200: {
                  description: "Search results",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          query: { type: "string", example: "labrador" },
                          count: { type: "integer", example: 3 },
                          results: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                breed: { type: "string", example: "labrador" },
                                displayName: {
                                  type: "string",
                                  example: "Labrador",
                                },
                                subBreeds: {
                                  type: "array",
                                  items: { type: "string" },
                                },
                                popularity: { type: "integer", example: 85 },
                                imageCount: { type: "integer", example: 42 },
                                relevanceScore: {
                                  type: "number",
                                  example: 0.95,
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
          "/.netlify/functions/breeds-popular": {
            get: {
              summary: "Get Popular Breeds",
              description: "Returns the most viewed and requested dog breeds",
              tags: ["Search & Discovery"],
              parameters: [
                {
                  name: "limit",
                  in: "query",
                  description: "Number of breeds to return",
                  required: false,
                  schema: {
                    type: "integer",
                    minimum: 1,
                    maximum: 20,
                    default: 10,
                  },
                },
                {
                  name: "timeframe",
                  in: "query",
                  description: "Time period for popularity metrics",
                  required: false,
                  schema: {
                    type: "string",
                    enum: ["today", "week", "month", "all"],
                    default: "week",
                  },
                },
              ],
              responses: {
                200: {
                  description: "Popular breeds list",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          timeframe: { type: "string", example: "week" },
                          data: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                rank: { type: "integer", example: 1 },
                                breed: { type: "string", example: "labrador" },
                                displayName: {
                                  type: "string",
                                  example: "Labrador",
                                },
                                viewCount: { type: "integer", example: 1247 },
                                searchCount: { type: "integer", example: 456 },
                                popularityScore: {
                                  type: "number",
                                  example: 92.5,
                                },
                                trendingUp: { type: "boolean", example: true },
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
          "/.netlify/functions/breed-analytics": {
            get: {
              summary: "Get Breed Analytics",
              description:
                "Returns detailed analytics and metrics for a specific breed",
              tags: ["Analytics"],
              parameters: [
                {
                  name: "breed",
                  in: "query",
                  description: "Breed name",
                  required: true,
                  schema: { type: "string" },
                },
                {
                  name: "detailed",
                  in: "query",
                  description: "Include detailed analytics",
                  required: false,
                  schema: { type: "boolean", default: false },
                },
              ],
              responses: {
                200: {
                  description: "Breed analytics data",
                  content: {
                    "application/json": {
                      schema: {
                        type: "object",
                        properties: {
                          success: { type: "boolean", example: true },
                          breed: { type: "string", example: "labrador" },
                          data: {
                            type: "object",
                            properties: {
                              overview: {
                                type: "object",
                                properties: {
                                  totalViews: {
                                    type: "integer",
                                    example: 1247,
                                  },
                                  totalSearches: {
                                    type: "integer",
                                    example: 456,
                                  },
                                  imagesAvailable: {
                                    type: "integer",
                                    example: 42,
                                  },
                                  lastViewed: {
                                    type: "string",
                                    format: "date-time",
                                  },
                                  popularityRank: {
                                    type: "integer",
                                    example: 3,
                                  },
                                },
                              },
                              trends: {
                                type: "object",
                                properties: {
                                  dailyViews: {
                                    type: "array",
                                    items: { type: "integer" },
                                  },
                                  weeklyGrowth: {
                                    type: "number",
                                    example: 15.5,
                                  },
                                  peakHour: { type: "integer", example: 14 },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                404: {
                  description: "Breed not found",
                },
              },
            },
          },
          "/.netlify/functions/admin-breeds": {
            get: {
              summary: "Get All Breeds",
              description: "Returns all breeds with details",
              tags: ["CRUD Operations"],
              parameters: [],
              responses: {
                200: {
                  description: "All breeds with admin details",
                },
              },
            },
            post: {
              summary: "Add New Breed",
              description: "Adds a new breed to the database",
              tags: ["CRUD Operations"],
              parameters: [],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["breed", "displayName"],
                      properties: {
                        breed: { type: "string", example: "newfoundland" },
                        displayName: {
                          type: "string",
                          example: "Newfoundland",
                        },
                        subBreeds: { type: "array", items: { type: "string" } },
                        description: { type: "string" },
                        characteristics: {
                          type: "object",
                          properties: {
                            size: { type: "string", example: "large" },
                            energy: { type: "string", example: "moderate" },
                            temperament: { type: "string", example: "gentle" },
                          },
                        },
                      },
                    },
                  },
                },
              },
              responses: {
                201: {
                  description: "Breed created successfully",
                },
                400: {
                  description: "Invalid breed data",
                },

                409: {
                  description: "Breed already exists",
                },
              },
            },
            put: {
              summary: "Update Breed",
              description: "Updates an existing breed in the database",
              tags: ["CRUD Operations"],
              parameters: [],
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: {
                      type: "object",
                      required: ["breed"],
                      properties: {
                        breed: { type: "string", example: "labrador" },
                        displayName: {
                          type: "string",
                          example: "Labrador Retriever",
                        },
                        subBreeds: { type: "array", items: { type: "string" } },
                        description: { type: "string" },
                        isActive: { type: "boolean", example: true },
                      },
                    },
                  },
                },
              },
              responses: {
                200: {
                  description: "Breed updated successfully",
                },
                400: {
                  description: "Invalid breed data",
                },

                404: {
                  description: "Breed not found",
                },
              },
            },
            delete: {
              summary: "Delete Breed",
              description: "Removes a breed from the database",
              tags: ["CRUD Operations"],
              parameters: [
                {
                  name: "breed",
                  in: "query",
                  description: "Breed name to delete",
                  required: true,
                  schema: { type: "string" },
                },
              ],
              responses: {
                200: {
                  description: "Breed deleted successfully",
                },

                404: {
                  description: "Breed not found",
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
            name: "Cache Management",
            description: "Database cache status and management",
          },
          {
            name: "Search & Discovery",
            description: "Search and discovery endpoints for breeds",
          },
          {
            name: "Analytics",
            description: "Breed analytics and performance metrics",
          },
          {
            name: "CRUD Operations",
            description:
              "Create, Read, Update, Delete operations for breed management",
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
