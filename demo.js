const axios = require('axios');
const logger = require('./src/utils/logger');

// API base URL
const API_BASE = 'http://localhost:3000/api';

// Helper function to make API calls
async function apiCall(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${endpoint}`,
      headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`Error with ${method} ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Demo functions
async function checkAPIHealth() {
  console.log('🏥 Checking Mini Project 3 API health...');
  const response = await apiCall('GET', '/health');
  console.log('✅ API is healthy:', response.message);
  console.log('🌐 Environment:', response.environment);
  console.log('📊 External API:', response.externalAPI.url);
  console.log('');
}

async function demonstrateDataSync() {
  console.log('🔄 Demonstrating Data Synchronization:');
  console.log('=====================================');

  try {
    console.log('\n1. Starting full data synchronization...');
    const syncResult = await apiCall('POST', '/sync/all');
    console.log('✅ Synchronization completed successfully');
    console.log(`📊 Users: ${syncResult.data.stats.users.created} created, ${syncResult.data.stats.users.updated} updated`);
    console.log(`📝 Posts: ${syncResult.data.stats.posts.created} created, ${syncResult.data.stats.posts.updated} updated`);
    console.log(`💬 Comments: ${syncResult.data.stats.comments.created} created, ${syncResult.data.stats.comments.updated} updated`);
    console.log(`⏱️ Duration: ${syncResult.data.duration}`);
  } catch (error) {
    console.log('⚠️ Sync may have already been completed or external API unavailable');
  }

  console.log('');
}

async function demonstrateUserCRUD() {
  console.log('👥 Demonstrating User CRUD Operations:');
  console.log('======================================');

  let createdUser = null;

  try {
    // CREATE - Create a new user
    console.log('\n1. Creating a new user...');
    const newUser = {
      name: 'Demo User',
      username: 'demouser123',
      email: 'demo@example.com',
      phone: '+1-555-0123',
      website: 'https://demouser.com',
      address: {
        street: '123 Demo Street',
        city: 'Demo City',
        zipcode: '12345'
      },
      company: {
        name: 'Demo Company',
        catchPhrase: 'Demonstrating awesome APIs'
      }
    };

    createdUser = await apiCall('POST', '/users', newUser);
    console.log(`✅ User created: ${createdUser.data.name} (${createdUser.data.email})`);

    // READ - Get all users
    console.log('\n2. Getting all users (first page)...');
    const allUsers = await apiCall('GET', '/users?page=1&limit=5');
    console.log(`📋 Found ${allUsers.pagination.totalItems} total users`);
    allUsers.data.slice(0, 3).forEach(user => {
      console.log(`   - ${user.name} (@${user.username})`);
    });

    // READ - Get user by ID
    console.log('\n3. Getting user by ID...');
    const userById = await apiCall('GET', `/users/${createdUser.data.id}`);
    console.log(`👤 User details: ${userById.data.name} - ${userById.data.email}`);

    // UPDATE - Update the user
    console.log('\n4. Updating user information...');
    const updateData = {
      name: 'Updated Demo User',
      phone: '+1-555-9999'
    };
    const updatedUser = await apiCall('PUT', `/users/${createdUser.data.id}`, updateData);
    console.log(`✅ User updated: ${updatedUser.data.name}`);

    // READ - Search users
    console.log('\n5. Searching users...');
    const searchResults = await apiCall('GET', '/users/search?q=demo&limit=3');
    console.log(`🔍 Search results for "demo": ${searchResults.data.length} users found`);

    // READ - Get user stats
    console.log('\n6. Getting user statistics...');
    const userStats = await apiCall('GET', `/users/${createdUser.data.id}/stats`);
    console.log(`📊 User stats: ${userStats.data.content.totalPosts} posts, ${userStats.data.content.totalComments} comments`);

  } catch (error) {
    console.error('❌ Error in user CRUD operations:', error.message);
  }

  console.log('');
  return createdUser;
}

async function demonstratePostCRUD(user) {
  console.log('📝 Demonstrating Post CRUD Operations:');
  console.log('======================================');

  let createdPost = null;

  try {
    // CREATE - Create a new post
    console.log('\n1. Creating a new post...');
    const newPost = {
      title: 'My Demo Blog Post',
      body: 'This is a comprehensive demo post created to showcase the Mini Project 3 API. It includes various features like tags, categories, and rich content that demonstrates the full capabilities of our blogging platform.',
      userId: user.data.id,
      category: 'Technology',
      tags: ['demo', 'api', 'nodejs', 'mongodb'],
      status: 'published',
      excerpt: 'A demo post showcasing API capabilities'
    };

    createdPost = await apiCall('POST', '/posts', newPost);
    console.log(`✅ Post created: "${createdPost.data.title}"`);
    console.log(`📊 Word count: ${createdPost.data.content.wordCount}, Reading time: ${createdPost.data.readingTimeMinutes} min`);

    // READ - Get all posts
    console.log('\n2. Getting all posts (first page)...');
    const allPosts = await apiCall('GET', '/posts?page=1&limit=5&status=published');
    console.log(`📋 Found ${allPosts.pagination.totalItems} total posts`);
    allPosts.data.slice(0, 3).forEach(post => {
      console.log(`   - ${post.title} by ${post.userId.name}`);
    });

    // READ - Get post by ID
    console.log('\n3. Getting post by ID...');
    const postById = await apiCall('GET', `/posts/${createdPost.data.id}`);
    console.log(`📖 Post: "${postById.data.title}" - ${postById.data.stats.views} views`);

    // UPDATE - Update the post
    console.log('\n4. Updating post...');
    const updateData = {
      title: 'Updated Demo Blog Post',
      category: 'API Development'
    };
    const updatedPost = await apiCall('PUT', `/posts/${createdPost.data.id}`, updateData);
    console.log(`✅ Post updated: "${updatedPost.data.title}"`);

    // READ - Search posts
    console.log('\n5. Searching posts...');
    const searchResults = await apiCall('GET', '/posts/search?q=demo&limit=3');
    console.log(`🔍 Search results for "demo": ${searchResults.data.length} posts found`);

    // READ - Get trending posts
    console.log('\n6. Getting trending posts...');
    const trendingPosts = await apiCall('GET', '/posts/trending?days=30&limit=5');
    console.log(`📈 Trending posts (last 30 days): ${trendingPosts.data.length} posts`);

    // INTERACT - Like the post
    console.log('\n7. Liking the post...');
    const likeResult = await apiCall('POST', `/posts/${createdPost.data.id}/like`);
    console.log(`👍 Post liked! Total likes: ${likeResult.data.likes}`);

    // READ - Get post statistics
    console.log('\n8. Getting post statistics...');
    const postStats = await apiCall('GET', `/posts/${createdPost.data.id}/stats`);
    console.log(`📊 Post engagement: ${postStats.data.engagement.views} views, ${postStats.data.engagement.likes} likes`);

  } catch (error) {
    console.error('❌ Error in post CRUD operations:', error.message);
  }

  console.log('');
  return createdPost;
}

async function demonstrateCommentCRUD(post, user) {
  console.log('💬 Demonstrating Comment CRUD Operations:');
  console.log('=========================================');

  let createdComment = null;
  let createdReply = null;

  try {
    // CREATE - Create a new comment
    console.log('\n1. Creating a new comment...');
    const newComment = {
      name: 'Demo Commenter',
      email: 'commenter@example.com',
      body: 'This is a fantastic demo post! I really appreciate the comprehensive API documentation and the clear examples provided.',
      postId: post.data.id,
      userId: user.data.id
    };

    createdComment = await apiCall('POST', '/comments', newComment);
    console.log(`✅ Comment created by: ${createdComment.data.name}`);

    // CREATE - Create a reply to the comment
    console.log('\n2. Creating a reply to the comment...');
    const replyComment = {
      name: 'Demo Replier',
      email: 'replier@example.com',
      body: 'I completely agree! The API design is very intuitive.',
      postId: post.data.id,
      parentId: createdComment.data.id
    };

    createdReply = await apiCall('POST', '/comments', replyComment);
    console.log(`✅ Reply created by: ${createdReply.data.name} (depth: ${createdReply.data.depth})`);

    // READ - Get all comments
    console.log('\n3. Getting all comments (first page)...');
    const allComments = await apiCall('GET', '/comments?page=1&limit=5&status=approved');
    console.log(`📋 Found ${allComments.pagination.totalItems} total comments`);

    // READ - Get comments for the post
    console.log('\n4. Getting comments for the post...');
    const postComments = await apiCall('GET', `/comments/post/${post.data.id}?includeReplies=true`);
    console.log(`💬 Post has ${postComments.data.comments.length} root comments`);
    postComments.data.comments.forEach(comment => {
      console.log(`   - ${comment.name}: "${comment.body.substring(0, 50)}..."`);
      if (comment.replies && comment.replies.length > 0) {
        comment.replies.forEach(reply => {
          console.log(`     └─ ${reply.name}: "${reply.body.substring(0, 40)}..."`);
        });
      }
    });

    // READ - Get comment by ID
    console.log('\n5. Getting comment by ID...');
    const commentById = await apiCall('GET', `/comments/${createdComment.data.id}`);
    console.log(`💭 Comment: "${commentById.data.body.substring(0, 50)}..." by ${commentById.data.name}`);

    // UPDATE - Update the comment
    console.log('\n6. Updating comment...');
    const updateData = {
      body: 'This is an updated comment! The API functionality is even more impressive than I initially thought.'
    };
    const updatedComment = await apiCall('PUT', `/comments/${createdComment.data.id}`, updateData);
    console.log(`✅ Comment updated: "${updatedComment.data.body.substring(0, 50)}..."`);

    // INTERACT - Like the comment
    console.log('\n7. Liking the comment...');
    const likeResult = await apiCall('POST', `/comments/${createdComment.data.id}/like`);
    console.log(`👍 Comment liked! Total likes: ${likeResult.data.likes}`);

    // READ - Search comments
    console.log('\n8. Searching comments...');
    const searchResults = await apiCall('GET', '/comments/search?q=demo&limit=3');
    console.log(`🔍 Search results for "demo": ${searchResults.data.length} comments found`);

  } catch (error) {
    console.error('❌ Error in comment CRUD operations:', error.message);
  }

  console.log('');
  return { comment: createdComment, reply: createdReply };
}

async function demonstrateAdvancedFeatures(user, post, comments) {
  console.log('🚀 Demonstrating Advanced Features:');
  console.log('===================================');

  try {
    // User posts
    console.log('\n1. Getting user\'s posts...');
    const userPosts = await apiCall('GET', `/users/${user.data.id}/posts?status=published`);
    console.log(`📝 User has ${userPosts.pagination.totalItems} published posts`);

    // Post by user endpoint
    console.log('\n2. Getting posts by specific user...');
    const postsByUser = await apiCall('GET', `/posts/user/${user.data.id}?limit=5`);
    console.log(`📚 Found ${postsByUser.pagination.totalItems} posts by this user`);

    // Filter posts by category
    console.log('\n3. Filtering posts by category...');
    const categoryPosts = await apiCall('GET', '/posts?category=Technology&limit=3');
    console.log(`🏷️ Found ${categoryPosts.pagination.totalItems} posts in Technology category`);

    // Filter posts by tags
    console.log('\n4. Filtering posts by tags...');
    const taggedPosts = await apiCall('GET', '/posts?tags=demo,api&limit=3');
    console.log(`🏷️ Found ${taggedPosts.pagination.totalItems} posts with demo or api tags`);

    // Add tag to post
    console.log('\n5. Adding tag to post...');
    const tagResult = await apiCall('POST', `/posts/${post.data.id}/tags`, { tag: 'featured' });
    console.log(`🏷️ Tag added! Post now has tags: ${tagResult.data.tags.join(', ')}`);

    // Get post by slug (if available)
    if (post.data.slug) {
      console.log('\n6. Getting post by slug...');
      const postBySlug = await apiCall('GET', `/posts/slug/${post.data.slug}`);
      console.log(`🔗 Retrieved post by slug: "${postBySlug.data.title}"`);
    }

    // Update user status
    console.log('\n7. Updating user status...');
    const statusUpdate = await apiCall('PATCH', `/users/${user.data.id}/status`, { status: 'active' });
    console.log(`👤 User status updated to: ${statusUpdate.data.status}`);

    // Pagination demonstration
    console.log('\n8. Demonstrating pagination...');
    const page1 = await apiCall('GET', '/posts?page=1&limit=2');
    const page2 = await apiCall('GET', '/posts?page=2&limit=2');
    console.log(`📄 Page 1: ${page1.data.length} posts, Page 2: ${page2.data.length} posts`);
    console.log(`📊 Total pages: ${page1.pagination.totalPages}, Total items: ${page1.pagination.totalItems}`);

    // Sorting demonstration
    console.log('\n9. Demonstrating sorting...');
    const sortedPosts = await apiCall('GET', '/posts?sort=createdAt:desc&limit=3');
    console.log(`📅 Latest 3 posts (sorted by creation date):`);
    sortedPosts.data.forEach((post, index) => {
      console.log(`   ${index + 1}. ${post.title} (${new Date(post.createdAt).toLocaleDateString()})`);
    });

  } catch (error) {
    console.error('❌ Error in advanced features:', error.message);
  }

  console.log('');
}

async function demonstrateErrorHandling() {
  console.log('⚠️ Demonstrating Error Handling:');
  console.log('================================');

  try {
    // Test 404 error
    console.log('\n1. Testing 404 error (non-existent user)...');
    try {
      await apiCall('GET', '/users/507f1f77bcf86cd799439999');
    } catch (error) {
      console.log(`✅ 404 Error handled: ${error.response?.data?.message}`);
    }

    // Test validation error
    console.log('\n2. Testing validation error (invalid email)...');
    try {
      await apiCall('POST', '/users', {
        name: 'Test',
        username: 'test',
        email: 'invalid-email'
      });
    } catch (error) {
      console.log(`✅ Validation error handled: ${error.response?.data?.message}`);
    }

    // Test duplicate email error
    console.log('\n3. Testing duplicate constraint error...');
    try {
      await apiCall('POST', '/users', {
        name: 'Another User',
        username: 'anotheruser',
        email: 'demo@example.com' // This should already exist
      });
    } catch (error) {
      console.log(`✅ Duplicate error handled: ${error.response?.data?.message}`);
    }

    // Test invalid ID format
    console.log('\n4. Testing invalid ID format...');
    try {
      await apiCall('GET', '/posts/invalid-id');
    } catch (error) {
      console.log(`✅ Invalid ID error handled: ${error.response?.data?.message}`);
    }

  } catch (error) {
    console.error('❌ Unexpected error in error handling demo:', error.message);
  }

  console.log('');
}

async function cleanupDemo(user, post, comments) {
  console.log('🧹 Cleaning up demo data...');
  console.log('============================');

  try {
    // Delete comments first (due to foreign key constraints)
    if (comments.reply) {
      console.log('\n1. Deleting reply comment...');
      await apiCall('DELETE', `/comments/${comments.reply.data.id}`);
      console.log('✅ Reply deleted');
    }

    if (comments.comment) {
      console.log('\n2. Deleting main comment...');
      await apiCall('DELETE', `/comments/${comments.comment.data.id}`);
      console.log('✅ Comment deleted');
    }

    // Delete post
    if (post) {
      console.log('\n3. Deleting demo post...');
      await apiCall('DELETE', `/posts/${post.data.id}`);
      console.log('✅ Post deleted');
    }

    // Delete user
    if (user) {
      console.log('\n4. Deleting demo user...');
      await apiCall('DELETE', `/users/${user.data.id}`);
      console.log('✅ User deleted');
    }

  } catch (error) {
    console.log('⚠️ Some cleanup operations may have failed (this is expected if dependencies exist)');
  }

  console.log('');
}

async function displaySummary() {
  console.log('📊 Demo Summary:');
  console.log('================');

  try {
    // Get final statistics
    const health = await apiCall('GET', '/health');
    const users = await apiCall('GET', '/users?page=1&limit=1');
    const posts = await apiCall('GET', '/posts?page=1&limit=1');
    const comments = await apiCall('GET', '/comments?page=1&limit=1');

    console.log(`✅ Mini Project 3 API Demo Completed!`);
    console.log(`🌐 Environment: ${health.environment}`);
    console.log(`🔗 External API: ${health.externalAPI.url}`);
    console.log(`👥 Total users in database: ${users.pagination.totalItems}`);
    console.log(`📝 Total posts in database: ${posts.pagination.totalItems}`);
    console.log(`💬 Total comments in database: ${comments.pagination.totalItems}`);

    console.log('\n🚀 Features Demonstrated:');
    console.log('   • Complete CRUD operations for Users, Posts, and Comments');
    console.log('   • External API integration with JSONPlaceholder');
    console.log('   • Data synchronization from external source');
    console.log('   • Advanced querying (pagination, sorting, filtering, search)');
    console.log('   • Relationship management (Users → Posts → Comments)');
    console.log('   • Input validation and error handling');
    console.log('   • Engagement features (likes, statistics)');
    console.log('   • Content management (tags, categories, status)');
    console.log('   • Moderation capabilities');
    console.log('   • RESTful API design with proper HTTP status codes');

    console.log('\n💡 API Endpoints Available:');
    console.log('   • Swagger Documentation: http://localhost:3000/api/docs');
    console.log('   • Health Check: http://localhost:3000/api/health');
    console.log('   • Users: http://localhost:3000/api/users');
    console.log('   • Posts: http://localhost:3000/api/posts');
    console.log('   • Comments: http://localhost:3000/api/comments');
    console.log('   • Data Sync: http://localhost:3000/api/sync/all');

  } catch (error) {
    console.error('Error getting summary data:', error.message);
  }
}

// Main demo function
async function runDemo() {
  try {
    console.log('🚀 Starting Mini Project 3: Real-time Database API Demo');
    console.log('=========================================================\n');

    await checkAPIHealth();
    await demonstrateDataSync();

    const user = await demonstrateUserCRUD();
    if (!user) return;

    const post = await demonstratePostCRUD(user);
    if (!post) return;

    const comments = await demonstrateCommentCRUD(post, user);
    await demonstrateAdvancedFeatures(user, post, comments);
    await demonstrateErrorHandling();

    // Optional: Uncomment to clean up demo data
    // await cleanupDemo(user, post, comments);

    await displaySummary();

  } catch (error) {
    console.error('❌ Demo failed:', error.message);
    console.log('\n💡 Make sure:');
    console.log('   • Server is running: npm run dev');
    console.log('   • MongoDB is running and accessible');
    console.log('   • External API (JSONPlaceholder) is accessible');
    console.log('   • All dependencies are installed: npm install');
  }
}

// Run the demo
if (require.main === module) {
  runDemo();
}

module.exports = { runDemo };
