const Post = require('../models/Post');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { createError } = require('../middleware/errorHandler');

/**
 * Post Controller
 * Handles all post-related operations
 */
class PostController {
  /**
   * Create a new post
   * @route POST /api/posts
   */
  async createPost(req, res, next) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const postData = req.body;

      // Verify user exists
      const user = await User.findById(postData.userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Create new post
      const post = new Post({
        ...postData,
        syncSource: 'manual',
        publishedAt: postData.status === 'published' ? new Date() : null,
      });

      await post.save();

      // Update user's post count
      await this.updateUserPostCount(user._id);

      logger.info(`Post created successfully: ${post.title}`);

      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: post.toJSON(),
      });

    } catch (error) {
      logger.error('Error creating post:', error);
      next(error);
    }
  }

  /**
   * Get all posts with pagination and filtering
   * @route GET /api/posts
   */
  async getPosts(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt:desc',
        search = '',
        status = '',
        category = '',
        userId = '',
        tags = '',
      } = req.query;

      // Parse pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Parse sort
      const [sortField, sortOrder] = sort.split(':');
      const sortObj = {};
      sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;

      // Build query
      const query = {};

      // Add search condition
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { body: { $regex: search, $options: 'i' } },
          { excerpt: { $regex: search, $options: 'i' } },
        ];
      }

      // Add filters
      if (status) query.status = status;
      if (category) query.category = category;
      if (userId) query.userId = userId;
      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim());
        query.tags = { $in: tagArray };
      }

      // Execute query
      const [posts, totalPosts] = await Promise.all([
        Post.find(query)
          .populate('userId', 'name username email')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .select('-__v'),
        Post.countDocuments(query),
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalPosts / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({
        success: true,
        data: posts,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalPosts,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
        },
      });

    } catch (error) {
      logger.error('Error fetching posts:', error);
      next(error);
    }
  }

  /**
   * Get post by ID
   * @route GET /api/posts/:id
   */
  async getPostById(req, res, next) {
    try {
      const { id } = req.params;

      const post = await Post.findById(id)
        .populate('userId', 'name username email')
        .select('-__v');

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      // Increment view count
      await post.incrementViews();

      res.json({
        success: true,
        data: post.toJSON(),
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid post ID format',
        });
      }

      logger.error('Error fetching post:', error);
      next(error);
    }
  }

  /**
   * Update post by ID
   * @route PUT /api/posts/:id
   */
  async updatePost(req, res, next) {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array(),
        });
      }

      const { id } = req.params;
      const updateData = req.body;

      // Find post
      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      // Verify user exists if userId is being updated
      if (updateData.userId && updateData.userId !== post.userId.toString()) {
        const user = await User.findById(updateData.userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found',
          });
        }
      }

      // Handle status change to published
      if (updateData.status === 'published' && post.status !== 'published') {
        updateData.publishedAt = new Date();
      }

      // Update post
      Object.assign(post, updateData);
      await post.save();

      logger.info(`Post updated successfully: ${post.title}`);

      res.json({
        success: true,
        message: 'Post updated successfully',
        data: post.toJSON(),
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid post ID format',
        });
      }

      logger.error('Error updating post:', error);
      next(error);
    }
  }

  /**
   * Delete post by ID
   * @route DELETE /api/posts/:id
   */
  async deletePost(req, res, next) {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      // Check if post has comments
      const Comment = require('../models/Comment');
      const commentCount = await Comment.countDocuments({ postId: id });

      if (commentCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Cannot delete post with existing comments',
          details: {
            comments: commentCount,
          },
        });
      }

      const userId = post.userId;
      await Post.findByIdAndDelete(id);

      // Update user's post count
      await this.updateUserPostCount(userId);

      logger.info(`Post deleted successfully: ${post.title}`);

      res.json({
        success: true,
        message: 'Post deleted successfully',
        data: {
          id: post._id,
          title: post.title,
          deletedAt: new Date().toISOString(),
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid post ID format',
        });
      }

      logger.error('Error deleting post:', error);
      next(error);
    }
  }

  /**
   * Get posts by user
   * @route GET /api/posts/user/:userId
   */
  async getPostsByUser(req, res, next) {
    try {
      const { userId } = req.params;
      const {
        page = 1,
        limit = 10,
        status = 'published',
      } = req.query;

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Parse pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query = { userId };
      if (status) query.status = status;

      // Execute query
      const [posts, totalPosts] = await Promise.all([
        Post.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .select('-__v'),
        Post.countDocuments(query),
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalPosts / limitNum);

      res.json({
        success: true,
        data: {
          user: user.getPublicProfile(),
          posts,
        },
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalPosts,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      logger.error('Error fetching posts by user:', error);
      next(error);
    }
  }

  /**
   * Search posts
   * @route GET /api/posts/search
   */
  async searchPosts(req, res, next) {
    try {
      const {
        q: searchTerm = '',
        page = 1,
        limit = 10,
        status = 'published',
        category = '',
        tags = '',
      } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          message: 'Search term is required',
        });
      }

      const options = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 50),
        status,
        category: category || null,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : null,
      };

      const posts = await Post.searchPosts(searchTerm, options);

      // Count total results
      const query = { $text: { $search: searchTerm } };
      if (status) query.status = status;
      if (category) query.category = category;
      if (tags) {
        const tagArray = tags.split(',').map(tag => tag.trim());
        query.tags = { $in: tagArray };
      }

      const totalPosts = await Post.countDocuments(query);
      const totalPages = Math.ceil(totalPosts / options.limit);

      res.json({
        success: true,
        data: posts,
        search: {
          term: searchTerm,
          resultsCount: posts.length,
          totalResults: totalPosts,
        },
        pagination: {
          currentPage: options.page,
          totalPages,
          totalItems: totalPosts,
          itemsPerPage: options.limit,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1,
        },
      });

    } catch (error) {
      logger.error('Error searching posts:', error);
      next(error);
    }
  }

  /**
   * Get trending posts
   * @route GET /api/posts/trending
   */
  async getTrendingPosts(req, res, next) {
    try {
      const {
        days = 7,
        limit = 10,
      } = req.query;

      const posts = await Post.getTrendingPosts(parseInt(days), parseInt(limit));

      res.json({
        success: true,
        data: posts,
        meta: {
          timeframe: `${days} days`,
          count: posts.length,
        },
      });

    } catch (error) {
      logger.error('Error fetching trending posts:', error);
      next(error);
    }
  }

  /**
   * Get post by slug
   * @route GET /api/posts/slug/:slug
   */
  async getPostBySlug(req, res, next) {
    try {
      const { slug } = req.params;

      const post = await Post.findBySlug(slug)
        .populate('userId', 'name username email');

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      // Increment view count
      await post.incrementViews();

      res.json({
        success: true,
        data: post.toJSON(),
      });

    } catch (error) {
      logger.error('Error fetching post by slug:', error);
      next(error);
    }
  }

  /**
   * Like a post
   * @route POST /api/posts/:id/like
   */
  async likePost(req, res, next) {
    try {
      const { id } = req.params;

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      await post.incrementLikes();

      res.json({
        success: true,
        message: 'Post liked successfully',
        data: {
          id: post._id,
          likes: post.stats.likes,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid post ID format',
        });
      }

      logger.error('Error liking post:', error);
      next(error);
    }
  }

  /**
   * Add tag to post
   * @route POST /api/posts/:id/tags
   */
  async addTag(req, res, next) {
    try {
      const { id } = req.params;
      const { tag } = req.body;

      if (!tag) {
        return res.status(400).json({
          success: false,
          message: 'Tag is required',
        });
      }

      const post = await Post.findById(id);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      await post.addTag(tag);

      res.json({
        success: true,
        message: 'Tag added successfully',
        data: {
          id: post._id,
          tags: post.tags,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid post ID format',
        });
      }

      logger.error('Error adding tag:', error);
      next(error);
    }
  }

  /**
   * Get post statistics
   * @route GET /api/posts/:id/stats
   */
  async getPostStats(req, res, next) {
    try {
      const { id } = req.params;

      const post = await Post.findById(id)
        .populate('userId', 'name username');

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      const Comment = require('../models/Comment');
      const commentCount = await Comment.countDocuments({ postId: id });

      const stats = {
        post: post.getPublicData(),
        engagement: {
          views: post.stats.views,
          likes: post.stats.likes,
          shares: post.stats.shares,
          comments: commentCount,
          engagementRate: post.engagementRate,
        },
        content: {
          wordCount: post.content.wordCount,
          readingTime: post.readingTimeMinutes,
          language: post.content.language,
        },
        meta: {
          isRecent: post.isRecent,
          isPublished: post.isPublished,
          publishedAt: post.publishedAt,
          lastUpdated: post.updatedAt,
        },
      };

      res.json({
        success: true,
        data: stats,
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid post ID format',
        });
      }

      logger.error('Error fetching post stats:', error);
      next(error);
    }
  }

  /**
   * Sync posts from external API
   * @route POST /api/posts/sync
   */
  async syncPosts(req, res, next) {
    try {
      const syncService = require('../services/syncService');

      const result = await syncService.syncPosts();

      res.json({
        success: true,
        message: 'Post synchronization completed',
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error syncing posts:', error);
      next(error);
    }
  }

  /**
   * Helper method to update user post count
   * @private
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
}

module.exports = new PostController();
