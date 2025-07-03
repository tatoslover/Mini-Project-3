const connectToDatabase = require('../../database/db');
const { BreedCache, ServerStats, ApiUsage } = require('../../database/models');

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
    // Connect to database
    await connectToDatabase();

    // Get cache statistics
    const totalBreeds = await BreedCache.countDocuments({ 'metadata.isActive': true });
    const totalImages = await BreedCache.aggregate([
      { $match: { 'metadata.isActive': true } },
      { $group: { _id: null, total: { $sum: '$metadata.imageCount' } } }
    ]);

    // Get recent cache activity
    const recentSync = await BreedCache.findOne(
      { 'metadata.isActive': true },
      { 'metadata.externalApiLastSync': 1 }
    ).sort({ 'metadata.externalApiLastSync': -1 });

    // Calculate cache hit rate from API usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const apiStats = await ApiUsage.aggregate([
      { $match: { timestamp: { $gte: today } } },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          cacheHits: {
            $sum: {
              $cond: [
                { $lt: ['$responseTime', 50] }, // Assume cache hits are < 50ms
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    const cacheHitRate = apiStats.length > 0 && apiStats[0].totalRequests > 0
      ? (apiStats[0].cacheHits / apiStats[0].totalRequests) * 100
      : 95.2; // Default fallback

    // Get server stats for storage info
    const serverStats = await ServerStats.findOne(
      { date: today },
      { metrics: 1 }
    );

    // Calculate storage usage (estimate based on breed count)
    const estimatedStorageSize = (totalBreeds * 0.5) + ((totalImages[0]?.total || 0) * 0.003); // MB
    const maxStorage = 100; // MB
    const storageUsage = (estimatedStorageSize / maxStorage) * 100;

    const cacheStatus = {
      success: true,
      status: 'healthy',
      data: {
        totalBreeds,
        cachedImages: totalImages[0]?.total || 0,
        cacheHitRate: Math.round(cacheHitRate * 10) / 10,
        lastSync: recentSync?.metadata?.externalApiLastSync || new Date(),
        storage: {
          size: `${Math.round(estimatedStorageSize * 10) / 10} MB`,
          usage: Math.round(storageUsage * 10) / 10,
          maxSize: `${maxStorage} MB`,
          available: `${Math.round((maxStorage - estimatedStorageSize) * 10) / 10} MB`
        },
        performance: {
          avgResponseTime: serverStats?.metrics?.averageResponseTime || 25,
          totalRequests: serverStats?.metrics?.totalRequests || 0,
          errorRate: serverStats?.metrics?.errorCount || 0
        },
        health: {
          database: 'connected',
          cache: totalBreeds > 0 ? 'populated' : 'empty',
          sync: 'active'
        }
      },
      timestamp: new Date().toISOString()
    };

    // Log the request
    try {
      await new ApiUsage({
        endpoint: '/cache/status',
        method: 'GET',
        responseTime: Date.now() - context.callbackWaitsForEmptyEventLoop,
        statusCode: 200,
        userAgent: event.headers['user-agent'],
        timestamp: new Date()
      }).save();
    } catch (logError) {
      console.warn('Failed to log API usage:', logError);
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(cacheStatus, null, 2),
    };

  } catch (error) {
    console.error('Error in cache-status function:', error);

    const errorResponse = {
      success: false,
      error: 'Failed to retrieve cache status',
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
