const apiService = require('./apiService');
const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const logger = require('../utils/logger');

/**
 * Sync Service for data synchronization
 * Handles synchronization between external API and local database
 */
class SyncService {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncTime = null;
    this.syncStats = {
      users: { created: 0, updated: 0, errors: 0 },
      posts: { created: 0, updated: 0, errors: 0 },
      comments: { created: 0, updated: 0, errors: 0 },
    };
  }

  /**
   * Sync all data from external API
   * @returns {Promise<Object>} - Sync results
   */
  async syncAll() {
    if (this.syncInProgress) {
      throw new Error('Sync operation already in progress');
    }

    this.syncInProgress = true;
    const startTime = Date.now();

    try {
      logger.sync('Starting full data synchronization');

      // Reset stats
      this.resetStats();

      // Check API connectivity first
      const healthCheck = await apiService.testConnection();
      if (!healthCheck.success) {
        throw new Error(`External API is not accessible: ${healthCheck.error}`);
      }

      // Sync in order: Users -> Posts -> Comments (due to dependencies)
      await this.syncUsers();
      await this.syncPosts();
      await this.syncComments();

      const duration = Date.now() - startTime;
      this.lastSyncTime = new Date();

      const results = {
        success: true,
        duration: `${duration}ms`,
        timestamp: this.lastSyncTime.toISOString(),
        stats: { ...this.syncStats },
        summary: {
          totalCreated: this.getTotalCreated(),
          totalUpdated: this.getTotalUpdated(),
          totalErrors: this.getTotalErrors(),
        },
      };

      logger.sync('Full synchronization completed successfully', results);
      return results;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Full synchronization failed:', error);

      return {
        success: false,
        error: error.message,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        stats: { ...this.syncStats },
      };

    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync users from external API
   * @returns {Promise<Object>} - Sync results for users
   */
  async syncUsers() {
    try {
      logger.sync('Starting user synchronization');

      const externalUsers = await apiService.getUsers();
      logger.sync(`Fetched ${externalUsers.length} users from external API`);

      for (const externalUser of externalUsers) {
        try {
          await this.syncSingleUser(externalUser);
          this.syncStats.users.updated++;
        } catch (error) {
          logger.error(`Failed to sync user ${externalUser.id}:`, error);
          this.syncStats.users.errors++;
        }
      }

      logger.sync('User synchronization completed', {
        created: this.syncStats.users.created,
        updated: this.syncStats.users.updated,
        errors: this.syncStats.users.errors,
      });

      return this.syncStats.users;

    } catch (error) {
      logger.error('User synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Sync posts from external API
   * @returns {Promise<Object>} - Sync results for posts
   */
  async syncPosts() {
    try {
      logger.sync('Starting post synchronization');

      const externalPosts = await apiService.getPosts();
      logger.sync(`Fetched ${externalPosts.length} posts from external API`);

      for (const externalPost of externalPosts) {
        try {
          await this.syncSinglePost(externalPost);
          this.syncStats.posts.updated++;
        } catch (error) {
          logger.error(`Failed to sync post ${externalPost.id}:`, error);
          this.syncStats.posts.errors++;
        }
      }

      logger.sync('Post synchronization completed', {
        created: this.syncStats.posts.created,
        updated: this.syncStats.posts.updated,
        errors: this.syncStats.posts.errors,
      });

      return this.syncStats.posts;

    } catch (error) {
      logger.error('Post synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Sync comments from external API
   * @returns {Promise<Object>} - Sync results for comments
   */
  async syncComments() {
    try {
      logger.sync('Starting comment synchronization');

      const externalComments = await apiService.getComments();
      logger.sync(`Fetched ${externalComments.length} comments from external API`);

      for (const externalComment of externalComments) {
        try {
          await this.syncSingleComment(externalComment);
          this.syncStats.comments.updated++;
        } catch (error) {
          logger.error(`Failed to sync comment ${externalComment.id}:`, error);
          this.syncStats.comments.errors++;
        }
      }

      logger.sync('Comment synchronization completed', {
        created: this.syncStats.comments.created,
        updated: this.syncStats.comments.updated,
        errors: this.syncStats.comments.errors,
      });

      return this.syncStats.comments;

    } catch (error) {
      logger.error('Comment synchronization failed:', error);
      throw error;
    }
  }

  /**
   * Sync a single user
   * @param {Object} externalUser - User data from external API
   * @returns {Promise<Object>} - Synced user
   */
  async syncSingleUser(externalUser) {
    try {
      // Check if user already exists
      let user = await User.findByExternalId(externalUser.id);

      const userData = {
        externalId: externalUser.id,
        name: externalUser.name,
        username: externalUser.username,
        email: externalUser.email,
        phone: externalUser.phone,
        website: externalUser.website,
        address: externalUser.address,
        company: externalUser.company,
        syncedAt: new Date(),
        syncSource: 'api',
      };

      if (user) {
        // Update existing user
        Object.assign(user, userData);
        await user.save();
        logger.sync(`Updated user: ${user.username}`);
      } else {
        // Create new user
        user = new User(userData);
        await user.save();
        this.syncStats.users.created++;
        logger.sync(`Created user: ${user.username}`);
      }

      return user;

    } catch (error) {
      logger.error(`Error syncing user ${externalUser.id}:`, error);
      throw error;
    }
  }

  /**
   * Sync a single post
   * @param {Object} externalPost - Post data from external API
   * @returns {Promise<Object>} - Synced post
   */
  async syncSinglePost(externalPost) {
    try {
      // Find the user for this post
      const user = await User.findByExternalId(externalPost.userId);
      if (!user) {
        throw new Error(`User with external ID ${externalPost.userId} not found`);
      }

      // Check if post already exists
      let post = await Post.findByExternalId(externalPost.id);

      const postData = {
        externalId: externalPost.id,
        title: externalPost.title,
        body: externalPost.body,
        userId: user._id,
        externalUserId: externalPost.userId,
        status: 'published',
        visibility: 'public',
        publishedAt: new Date(),
        syncedAt: new Date(),
        syncSource: 'api',
      };

      if (post) {
        // Update existing post
        Object.assign(post, postData);
        await post.save();
        logger.sync(`Updated post: ${post.title}`);
      } else {
        // Create new post
        post = new Post(postData);
        await post.save();
        this.syncStats.posts.created++;
        logger.sync(`Created post: ${post.title}`);
      }

      // Update user's post count
      await this.updateUserPostCount(user._id);

      return post;

    } catch (error) {
      logger.error(`Error syncing post ${externalPost.id}:`, error);
      throw error;
    }
  }

  /**
   * Sync a single comment
   * @param {Object} externalComment - Comment data from external API
   * @returns {Promise<Object>} - Synced comment
   */
  async syncSingleComment(externalComment) {
    try {
      // Find the post for this comment
      const post = await Post.findByExternalId(externalComment.postId);
      if (!post) {
        throw new Error(`Post with external ID ${externalComment.postId} not found`);
      }

      // Check if comment already exists
      let comment = await Comment.findByExternalId(externalComment.id);

      const commentData = {
        externalId: externalComment.id,
        postId: post._id,
        externalPostId: externalComment.postId,
        name: externalComment.name,
        email: externalComment.email,
        body: externalComment.body,
        status: 'approved',
        visibility: 'public',
        syncedAt: new Date(),
        syncSource: 'api',
      };

      if (comment) {
        // Update existing comment
        Object.assign(comment, commentData);
        await comment.save();
        logger.sync(`Updated comment by: ${comment.name}`);
      } else {
        // Create new comment
        comment = new Comment(commentData);
        await comment.save();
        this.syncStats.comments.created++;
        logger.sync(`Created comment by: ${comment.name}`);
      }

      // Update post's comment count
      await this.updatePostCommentCount(post._id);

      return comment;

    } catch (error) {
      logger.error(`Error syncing comment ${externalComment.id}:`, error);
      throw error;
    }
  }

  /**
   * Update user's post count
   * @param {ObjectId} userId - User ID
   * @returns {Promise<void>}
   */
  async updateUserPostCount(userId) {
    try {
      const postCount = await Post.countDocuments({ userId });
      await User.findByIdAndUpdate(userId, {
        'stats.postCount': postCount,
        'stats.lastActivity': new Date(),
      });
    } catch (error) {
      logger.error('Error updating user post count:', error);
    }
  }

  /**
   * Update post's comment count
   * @param {ObjectId} postId - Post ID
   * @returns {Promise<void>}
   */
  async updatePostCommentCount(postId) {
    try {
      const commentCount = await Comment.countDocuments({ postId });
      await Post.findByIdAndUpdate(postId, {
        'stats.comments': commentCount,
      });
    } catch (error) {
      logger.error('Error updating post comment count:', error);
    }
  }

  /**
   * Sync specific user by external ID
   * @param {number} externalUserId - External user ID
   * @returns {Promise<Object>} - Sync result
   */
  async syncUserById(externalUserId) {
    try {
      logger.sync(`Syncing user with external ID: ${externalUserId}`);

      const externalUser = await apiService.getUserById(externalUserId);
      const user = await this.syncSingleUser(externalUser);

      return {
        success: true,
        user: user.toJSON(),
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error(`Failed to sync user ${externalUserId}:`, error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Sync specific post by external ID
   * @param {number} externalPostId - External post ID
   * @returns {Promise<Object>} - Sync result
   */
  async syncPostById(externalPostId) {
    try {
      logger.sync(`Syncing post with external ID: ${externalPostId}`);

      const externalPost = await apiService.getPostById(externalPostId);
      const post = await this.syncSinglePost(externalPost);

      return {
        success: true,
        post: post.toJSON(),
        timestamp: new Date().toISOString(),
      };

    } catch (error) {
      logger.error(`Failed to sync post ${externalPostId}:`, error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get sync status
   * @returns {Object} - Current sync status
   */
  getSyncStatus() {
    return {
      syncInProgress: this.syncInProgress,
      lastSyncTime: this.lastSyncTime,
      stats: { ...this.syncStats },
      summary: {
        totalCreated: this.getTotalCreated(),
        totalUpdated: this.getTotalUpdated(),
        totalErrors: this.getTotalErrors(),
      },
    };
  }

  /**
   * Reset sync statistics
   */
  resetStats() {
    this.syncStats = {
      users: { created: 0, updated: 0, errors: 0 },
      posts: { created: 0, updated: 0, errors: 0 },
      comments: { created: 0, updated: 0, errors: 0 },
    };
  }

  /**
   * Get total created records
   * @returns {number} - Total created records
   */
  getTotalCreated() {
    return this.syncStats.users.created +
           this.syncStats.posts.created +
           this.syncStats.comments.created;
  }

  /**
   * Get total updated records
   * @returns {number} - Total updated records
   */
  getTotalUpdated() {
    return this.syncStats.users.updated +
           this.syncStats.posts.updated +
           this.syncStats.comments.updated;
  }

  /**
   * Get total errors
   * @returns {number} - Total errors
   */
  getTotalErrors() {
    return this.syncStats.users.errors +
           this.syncStats.posts.errors +
           this.syncStats.comments.errors;
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} - Database statistics
   */
  async getDatabaseStats() {
    try {
      const [userCount, postCount, commentCount] = await Promise.all([
        User.countDocuments(),
        Post.countDocuments(),
        Comment.countDocuments(),
      ]);

      const [syncedUsers, syncedPosts, syncedComments] = await Promise.all([
        User.countDocuments({ syncSource: 'api' }),
        Post.countDocuments({ syncSource: 'api' }),
        Comment.countDocuments({ syncSource: 'api' }),
      ]);

      return {
        total: {
          users: userCount,
          posts: postCount,
          comments: commentCount,
        },
        synced: {
          users: syncedUsers,
          posts: syncedPosts,
          comments: syncedComments,
        },
        lastSyncTime: this.lastSyncTime,
        syncInProgress: this.syncInProgress,
      };

    } catch (error) {
      logger.error('Error getting database stats:', error);
      throw error;
    }
  }

  /**
   * Clean up orphaned records
   * @returns {Promise<Object>} - Cleanup results
   */
  async cleanupOrphanedRecords() {
    try {
      logger.sync('Starting cleanup of orphaned records');

      // Find posts without valid users
      const orphanedPosts = await Post.find().populate('userId');
      const postsToDelete = orphanedPosts.filter(post => !post.userId);

      // Find comments without valid posts
      const orphanedComments = await Comment.find().populate('postId');
      const commentsToDelete = orphanedComments.filter(comment => !comment.postId);

      // Delete orphaned records
      const deletedPosts = await Post.deleteMany({
        _id: { $in: postsToDelete.map(p => p._id) }
      });

      const deletedComments = await Comment.deleteMany({
        _id: { $in: commentsToDelete.map(c => c._id) }
      });

      const results = {
        deletedPosts: deletedPosts.deletedCount,
        deletedComments: deletedComments.deletedCount,
        timestamp: new Date().toISOString(),
      };

      logger.sync('Cleanup completed', results);
      return results;

    } catch (error) {
      logger.error('Error during cleanup:', error);
      throw error;
    }
  }
}

// Create and export singleton instance
const syncService = new SyncService();

module.exports = syncService;
