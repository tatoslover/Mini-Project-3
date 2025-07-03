const connectToDatabase = require('../../database/db');
const { BreedCache, ApiUsage } = require('../../database/models');

exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
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
        timestamp: new Date().toISOString(),
      }),
    };
  }

  try {
    // Extract breed from path parameters
    const pathParts = event.path.split('/');
    const breed = pathParts[pathParts.length - 2]; // /breeds/{breed}/analytics

    // Parse query parameters
    const queryParams = event.queryStringParameters || {};
    const detailed = queryParams.detailed === 'true';

    // Validate breed parameter
    if (!breed || breed === 'analytics') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Breed parameter is required',
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Connect to database
    await connectToDatabase();

    // Find the breed in cache
    const breedData = await BreedCache.findOne({
      breed: breed.toLowerCase(),
      'metadata.isActive': true
    });

    if (!breedData) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Breed not found',
          breed,
          timestamp: new Date().toISOString(),
        }),
      };
    }

    // Get analytics data for this breed
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

    // Aggregate usage data for this breed
    const usageStats = await ApiUsage.aggregate([
      {
        $match: {
          'metadata.breed': breed.toLowerCase(),
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: null,
          totalViews: { $sum: 1 },
          totalSearches: {
            $sum: {
              $cond: [{ $eq: ['$endpoint', '/search'] }, 1, 0]
            }
          },
          avgResponseTime: { $avg: '$responseTime' },
          lastViewed: { $max: '$timestamp' },
          uniqueSessions: { $addToSet: '$sessionId' }
        }
      }
    ]);

    // Get daily view trends
    const dailyTrends = await ApiUsage.aggregate([
      {
        $match: {
          'metadata.breed': breed.toLowerCase(),
          timestamp: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          views: { $sum: 1 },
          avgResponseTime: { $avg: '$responseTime' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Get hourly distribution
    const hourlyDistribution = await ApiUsage.aggregate([
      {
        $match: {
          'metadata.breed': breed.toLowerCase(),
          timestamp: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $hour: '$timestamp' },
          views: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } }
    ]);

    // Calculate popularity rank
    const allBreedViews = await ApiUsage.aggregate([
      {
        $match: {
          'metadata.breed': { $exists: true, $ne: null },
          timestamp: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$metadata.breed',
          views: { $sum: 1 }
        }
      },
      { $sort: { views: -1 } }
    ]);

    const popularityRank = allBreedViews.findIndex(b => b._id === breed.toLowerCase()) + 1;

    // Calculate weekly growth
    const weeklyViews = await ApiUsage.countDocuments({
      'metadata.breed': breed.toLowerCase(),
      timestamp: { $gte: sevenDaysAgo }
    });

    const previousWeekViews = await ApiUsage.countDocuments({
      'metadata.breed': breed.toLowerCase(),
      timestamp: {
        $gte: new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000)),
        $lt: sevenDaysAgo
      }
    });

    const weeklyGrowth = previousWeekViews > 0
      ? ((weeklyViews - previousWeekViews) / previousWeekViews) * 100
      : weeklyViews > 0 ? 100 : 0;

    // Find peak hour
    const peakHour = hourlyDistribution.reduce((peak, current) => {
      return current.views > (peak.views || 0) ? current : peak;
    }, {})._id || 14;

    // Build response
    const analytics = {
      success: true,
      breed: breed.toLowerCase(),
      displayName: breedData.displayName,
      data: {
        overview: {
          totalViews: usageStats[0]?.totalViews || 0,
          totalSearches: usageStats[0]?.totalSearches || 0,
          imagesAvailable: breedData.metadata?.imageCount || 0,
          lastViewed: usageStats[0]?.lastViewed || null,
          popularityRank: popularityRank || 'N/A',
          uniqueSessions: usageStats[0]?.uniqueSessions?.length || 0
        },
        trends: {
          dailyViews: dailyTrends.map(d => d.views),
          weeklyGrowth: Math.round(weeklyGrowth * 10) / 10,
          peakHour,
          avgResponseTime: Math.round((usageStats[0]?.avgResponseTime || 0) * 10) / 10
        },
        metadata: {
          breedId: breedData.breedId,
          subBreed: breedData.subBreed,
          isActive: breedData.metadata?.isActive,
          lastCacheUpdate: breedData.updatedAt,
          externalApiLastSync: breedData.metadata?.externalApiLastSync
        }
      }
    };

    // Add detailed analytics if requested
    if (detailed) {
      analytics.data.detailed = {
        hourlyDistribution: hourlyDistribution.map(h => ({
          hour: h._id,
          views: h.views
        })),
        dailyTrendsDetailed: dailyTrends.map(d => ({
          date: `${d._id.year}-${String(d._id.month).padStart(2, '0')}-${String(d._id.day).padStart(2, '0')}`,
          views: d.views,
          avgResponseTime: Math.round(d.avgResponseTime * 10) / 10
        })),
        performance: {
          avgResponseTime: Math.round((usageStats[0]?.avgResponseTime || 0) * 10) / 10,
          totalDataPoints: (usageStats[0]?.totalViews || 0),
          analysisWindow: '30 days'
        }
      };
    }

    analytics.timestamp = new Date().toISOString();

    // Log the request
    try {
      await new ApiUsage({
        endpoint: '/breeds/analytics',
        method: 'GET',
        responseTime: Date.now() - context.callbackWaitsForEmptyEventLoop,
        statusCode: 200,
        userAgent: event.headers['user-agent'],
        metadata: {
          breed: breed.toLowerCase(),
          detailed
        },
        timestamp: new Date()
      }).save();
    } catch (logError) {
      console.warn('Failed to log API usage:', logError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(analytics, null, 2),
    };

  } catch (error) {
    console.error('Error in breed-analytics function:', error);

    const errorResponse = {
      success: false,
      error: 'Failed to retrieve breed analytics',
      message: error.message,
      breed: event.path.split('/')[event.path.split('/').length - 2] || 'unknown',
      timestamp: new Date().toISOString(),
    };

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse),
    };
  }
};
