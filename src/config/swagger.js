const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const logger = require('../utils/logger');

// Swagger definition
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mini Project 3: Real-time Database API',
      version: '1.0.0',
      description: 'External API integration with MongoDB following MVC pattern',
      contact: {
        name: 'IOD Student',
        email: 'student@iod.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: `http://${process.env.SWAGGER_HOST || 'localhost:3000'}${process.env.SWAGGER_BASE_PATH || '/api'}`,
        description: 'Development server',
      },
      {
        url: 'https://api.miniproject3.com/api',
        description: 'Production server',
      },
    ],
    components: {
      schemas: {
        User: {
          type: 'object',
          required: ['name', 'username', 'email'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '507f1f77bcf86cd799439011',
            },
            externalId: {
              type: 'number',
              description: 'External API ID',
              example: 1,
            },
            name: {
              type: 'string',
              description: 'Full name of the user',
              example: 'John Doe',
            },
            username: {
              type: 'string',
              description: 'Unique username',
              example: 'johndoe',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email address',
              example: 'john.doe@example.com',
            },
            phone: {
              type: 'string',
              description: 'Phone number',
              example: '+1-555-0123',
            },
            website: {
              type: 'string',
              format: 'uri',
              description: 'Personal website',
              example: 'https://johndoe.com',
            },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string', example: '123 Main St' },
                suite: { type: 'string', example: 'Apt 4B' },
                city: { type: 'string', example: 'New York' },
                zipcode: { type: 'string', example: '10001' },
                geo: {
                  type: 'object',
                  properties: {
                    lat: { type: 'string', example: '40.7128' },
                    lng: { type: 'string', example: '-74.0060' },
                  },
                },
              },
            },
            company: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'ACME Corp' },
                catchPhrase: { type: 'string', example: 'Multi-layered client-server neural-net' },
                bs: { type: 'string', example: 'harness real-time e-markets' },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Post: {
          type: 'object',
          required: ['title', 'body', 'userId'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '507f1f77bcf86cd799439012',
            },
            externalId: {
              type: 'number',
              description: 'External API ID',
              example: 1,
            },
            title: {
              type: 'string',
              description: 'Post title',
              example: 'My First Post',
            },
            body: {
              type: 'string',
              description: 'Post content',
              example: 'This is the content of my first post.',
            },
            userId: {
              type: 'string',
              description: 'User ID (MongoDB ObjectId)',
              example: '507f1f77bcf86cd799439011',
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Post tags',
              example: ['technology', 'programming'],
            },
            category: {
              type: 'string',
              description: 'Post category',
              example: 'Technology',
            },
            status: {
              type: 'string',
              enum: ['draft', 'published', 'archived'],
              description: 'Post status',
              example: 'published',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Comment: {
          type: 'object',
          required: ['name', 'email', 'body', 'postId'],
          properties: {
            _id: {
              type: 'string',
              description: 'MongoDB ObjectId',
              example: '507f1f77bcf86cd799439013',
            },
            externalId: {
              type: 'number',
              description: 'External API ID',
              example: 1,
            },
            postId: {
              type: 'string',
              description: 'Post ID (MongoDB ObjectId)',
              example: '507f1f77bcf86cd799439012',
            },
            name: {
              type: 'string',
              description: 'Commenter name',
              example: 'Jane Smith',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Commenter email',
              example: 'jane.smith@example.com',
            },
            body: {
              type: 'string',
              description: 'Comment content',
              example: 'Great post! Thanks for sharing.',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            message: {
              type: 'string',
              example: 'An error occurred',
            },
            error: {
              type: 'string',
              example: 'Detailed error message',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
            },
            data: {
              type: 'object',
              description: 'Response data',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
            pagination: {
              type: 'object',
              properties: {
                currentPage: { type: 'number', example: 1 },
                totalPages: { type: 'number', example: 10 },
                totalItems: { type: 'number', example: 100 },
                itemsPerPage: { type: 'number', example: 10 },
                hasNextPage: { type: 'boolean', example: true },
                hasPrevPage: { type: 'boolean', example: false },
              },
            },
          },
        },
      },
      parameters: {
        IdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Resource ID',
          schema: {
            type: 'string',
            example: '507f1f77bcf86cd799439011',
          },
        },
        PageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number for pagination',
          schema: {
            type: 'integer',
            minimum: 1,
            default: 1,
          },
        },
        LimitParam: {
          name: 'limit',
          in: 'query',
          description: 'Number of items per page',
          schema: {
            type: 'integer',
            minimum: 1,
            maximum: 100,
            default: 10,
          },
        },
        SortParam: {
          name: 'sort',
          in: 'query',
          description: 'Sort field and order (e.g., name:asc, createdAt:desc)',
          schema: {
            type: 'string',
            example: 'createdAt:desc',
          },
        },
        SearchParam: {
          name: 'search',
          in: 'query',
          description: 'Search term',
          schema: {
            type: 'string',
            example: 'search term',
          },
        },
      },
      responses: {
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Resource not found',
                error: 'The requested resource does not exist',
                timestamp: '2023-12-01T10:00:00.000Z',
              },
            },
          },
        },
        BadRequest: {
          description: 'Bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Validation error',
                error: 'Invalid input data',
                timestamp: '2023-12-01T10:00:00.000Z',
              },
            },
          },
        },
        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                message: 'Internal server error',
                error: 'An unexpected error occurred',
                timestamp: '2023-12-01T10:00:00.000Z',
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Users',
        description: 'User management operations',
      },
      {
        name: 'Posts',
        description: 'Post management operations',
      },
      {
        name: 'Comments',
        description: 'Comment management operations',
      },
      {
        name: 'Sync',
        description: 'Data synchronization operations',
      },
      {
        name: 'Health',
        description: 'Health check and monitoring',
      },
    ],
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js',
  ],
};

// Generate swagger specification
const specs = swaggerJsdoc(options);

// Custom CSS for Swagger UI
const customCss = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .info .title { color: #3b82f6; }
  .swagger-ui .info .description { font-size: 14px; }
  .swagger-ui .scheme-container {
    background: #f8fafc;
    border-radius: 8px;
    padding: 15px;
    margin: 20px 0;
  }
  .swagger-ui .opblock.opblock-post { border-color: #10b981; }
  .swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
  .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
  .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
`;

// Setup function to add Swagger middleware to Express app
const setupSwagger = (app) => {
  try {
    // Serve swagger docs
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, {
      customCss,
      customSiteTitle: 'Mini Project 3 API Documentation',
      customfavIcon: '/favicon.ico',
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: true,
      },
    }));

    // Serve raw swagger spec
    app.get('/api/docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    logger.info('✅ Swagger documentation configured');
    logger.info(`📖 Swagger UI: http://localhost:${process.env.PORT || 3000}/api/docs`);
  } catch (error) {
    logger.error('❌ Error setting up Swagger:', error);
  }
};

module.exports = setupSwagger;
