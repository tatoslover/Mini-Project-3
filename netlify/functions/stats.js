const { connectToDatabase } = require('../../utils/db');
const { ServerStats, ApiUsage, User, FavoriteImage, BreedCache } = require('../../models/models');

exports.handler = async (event, context) => {
  const startTime = Date.now();

  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-session-id',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Method not allowed',
        timestamp: new Date().toISOString()
      })
    };
  }

  let userId = null;
  let sessionId = null;

  try {
    // Connect to database
    await connectToDatabase();

    // Extract user info from headers
    userId = event.headers['x-user-id'] || 'anonymous';
    sessionId = event.headers['x-session-id'] || `session_${Date.now()}`;

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const timeframe = queryParams.timeframe || 'today'; // today, week, month, all
    const detailed = queryParams.detailed === 'true';

    // Calculate date ranges
    const now = new Date();
    let startDate;

    switch (timeframe) {
      case 'week':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0); // Beginning of time
        break;
      default: // today
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
    }

    const endDate = new Date();

    // Get server statistics
    const serverStats = await ServerStats.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: '$metrics.totalRequests' },
          uniqueUsers: { $sum: '$metrics.uniqueUsers' },
          imagesServed: { $sum: '$metrics.imagesServed' },
          breedsViewed: { $sum: '$metrics.breedsViewed' },
          favoritesAdded: { $sum: '$metrics.favoritesAdded' },
          searchesPerformed: { $sum: '$metrics.searchesPerformed' },
          errorCount: { $sum: '$metrics.errorCount' },
          avgResponseTime: { $avg: '$metrics.averageResponseTime' },
          // Endpoint statistics
          healthCalls: { $sum: '$endpoints.health' },
          breedsCalls: { $sum: '$endpoints.breeds' },
          randomCalls: { $sum: '$endpoints.random' },
          breedImagesCalls: { $sum: '$endpoints.breedImages' },
          favoritesCalls: { $sum: '$endpoints.favorites' },
          searchCalls: { $sum: '$endpoints.search' },
          statsCalls: { $sum: '$endpoints.stats' }
        }
      }
    ]);

    const stats = serverStats[0] || {
      totalRequests: 0,
      uniqueUsers: 0,
      imagesServed: 0,
      breedsViewed: 0,
      favoritesAdded: 0,
      searchesPerformed: 0,
      errorCount: 0,
      avgResponseTime: 0,
      healthCalls: 0,
      breedsCalls: 0,
      randomCalls: 0,
      breedImagesCalls: 0,
      favoritesCalls: 0,
      searchCalls: 0,
      statsCalls: 0
    };

    // Get total breeds available
    const totalBreeds = await BreedCache.countDocuments({ 'metadata.isActive': true });

    // Get top breeds by popularity
    const topBreeds = await BreedCache.find({ 'metadata.isActive': true })
      .sort({ 'popularity.viewCount': -1 })
      .limit(10)
      .select('displayName popularity.viewCount popularity.favoriteCount')
      .lean();

    // Calculate uptime (simplified for serverless)
    const deployTime = parseInt(process.env.DEPLOY_TIME || Date.now());
    const uptime = Date.now() - deployTime;
    const uptimeHours = Math.floor(uptime / (1000 * 60 * 60));
    const uptimeMinutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
    const uptimeSeconds = Math.floor((uptime % (1000 * 60)) / 1000);

    const responseTime = Date.now() - startTime;

    // Basic response
    const response = {
      success: true,
      timeframe: timeframe,
      data: {
        overview: {
          totalRequests: stats.totalRequests,
          uniqueUsers: stats.uniqueUsers,
          imagesServed: stats.imagesServed,
          breedsViewed: stats.breedsViewed,
          favoritesAdded: stats.favoritesAdded,
          searchesPerformed: stats.searchesPerformed,
          totalBreeds: totalBreeds,
          errorRate: stats.totalRequests > 0 ?
            ((stats.errorCount / stats.totalRequests) * 100).toFixed(2) + '%' : '0%'
        },
        performance: {
          averageResponseTime: Math.round(stats.avgResponseTime || 0),
          uptime: {
            milliseconds: uptime,
            display: uptimeHours > 0 ?
              `${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s` :
              uptimeMinutes > 0 ?
                `${uptimeMinutes}m ${uptimeSeconds}s` :
                `${uptimeSeconds}s`,
            hours: uptimeHours,
            minutes: uptimeMinutes,
            seconds: uptimeSeconds
          },
          requestsPerHour: uptimeHours > 0 ?
            Math.round(stats.totalRequests / uptimeHours) : stats.totalRequests
        },
        endpoints: {
          health: stats.healthCalls,
          breeds: stats.breedsCalls,
          random: stats.randomCalls,
          breedImages: stats.breedImagesCalls,
          favorites: stats.favoritesCalls,
          search: stats.searchCalls,
          stats: stats.statsCalls + 1 // Include current request
        },
        topBreeds: topBreeds.map(breed => ({
          name: breed.displayName,
          views: breed.popularity?.viewCount || 0,
          favorites: breed.popularity?.favoriteCount || 0
        }))
      },
      metadata: {
        responseTime: `${responseTime}ms`,
        generatedAt: new Date().toISOString(),
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      timestamp: new Date().toISOString()
    };

    // Add detailed analytics if requested
    if (detailed) {
      // Get recent API usage patterns
      const recentUsage = await ApiUsage.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: {
              endpoint: '$endpoint',
              hour: { $hour: '$timestamp' }
            },
            count: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTime' },
            errors: {
              $sum: {
                $cond: [{ $gte: ['$statusCode', 400] }, 1, 0]
              }
            }
          }
        },
        {
          $sort: { '_id.hour': 1 }
        }
      ]);

      // Get user engagement stats
      const userStats = await User.aggregate([
        {
          $match: {
            'stats.lastActive': { $gte: startDate, $lte: endDate }
          }
        },
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            avgImagesViewed: { $avg: '$stats.imagesViewed' },
            avgBreedsExplored: { $avg: '$stats.breedsExplored' },
            totalSessions: { $sum: '$stats.sessionCount' }
          }
        }
      ]);

      const userEngagement = userStats[0] || {
        totalUsers: 0,
        avgImagesViewed: 0,
        avgBreedsExplored: 0,
        totalSessions: 0
      };

      // Get error distribution
      const errorDistribution = await ApiUsage.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate, $lte: endDate },
            statusCode: { $gte: 400 }
          }
        },
        {
          $group: {
            _id: '$statusCode',
            count: { $sum: 1 },
            endpoints: { $addToSet: '$endpoint' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ]);

      response.data.detailed = {
        usagePatterns: recentUsage,
        userEngagement: {
          totalActiveUsers: userEngagement.totalUsers,
          averageImagesPerUser: Math.round(userEngagement.avgImagesViewed || 0),
          averageBreedsPerUser: Math.round(userEngagement.avgBreedsExplored || 0),
          totalSessions: userEngagement.totalSessions,
          avgSessionsPerUser: userEngagement.totalUsers > 0 ?
            (userEngagement.totalSessions / userEngagement.totalUsers).toFixed(2) : 0
        },
        errors: errorDistribution.map(error => ({
          statusCode: error._id,
          count: error.count,
          affectedEndpoints: error.endpoints
        }))
      };
    }

    // Log this API call
    await ApiUsage.create({
      endpoint: '/stats',
      method: 'GET',
      userId,
      sessionId,
      responseTime,
      statusCode: 200,
      userAgent: event.headers['user-agent'],
      timestamp: new Date(),
      metadata: {
        timeframe: timeframe,
        detailed: detailed
      }
    });

    // Update daily stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await ServerStats.findOneAndUpdate(
      { date: today },
      {
        $inc: {
          'metrics.totalRequests': 1,
          'endpoints.stats': 1
        },
        $set: {
          'metrics.averageResponseTime': responseTime,
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('Error in stats function:', error);

    const responseTime = Date.now() - startTime;

    // Log error
    await ApiUsage.create({
      endpoint: '/stats',
      method: 'GET',
      userId,
      sessionId,
      responseTime,
      statusCode: 500,
      userAgent: event.headers['user-agent'],
      timestamp: new Date(),
      metadata: {
        error: error.message
      }
    }).catch(console.error);

    const errorResponse = {
      success: false,
      error: 'Failed to retrieve statistics',
      message: error.message,
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse)
    };
  }
};
