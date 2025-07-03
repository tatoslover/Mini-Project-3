const User = require('../models/User');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { createError } = require('../middleware/errorHandler');

/**
 * User Controller
 * Handles all user-related operations
 */
class UserController {
  /**
   * Create a new user
   * @route POST /api/users
   */
  async createUser(req, res, next) {
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

      const userData = req.body;

      // Check if user with email already exists
      const existingUser = await User.findByEmail(userData.email);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists',
        });
      }

      // Check if username is taken
      if (userData.username) {
        const existingUsername = await User.findByUsername(userData.username);
        if (existingUsername) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken',
          });
        }
      }

      // Create new user
      const user = new User({
        ...userData,
        syncSource: 'manual',
      });

      await user.save();

      logger.info(`User created successfully: ${user.email}`);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: user.toJSON(),
      });

    } catch (error) {
      logger.error('Error creating user:', error);
      next(error);
    }
  }

  /**
   * Get all users with pagination and filtering
   * @route GET /api/users
   */
  async getUsers(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt:desc',
        search = '',
        status = '',
        role = '',
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
          { name: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Add filters
      if (status) query.status = status;
      if (role) query.role = role;

      // Execute query
      const [users, totalUsers] = await Promise.all([
        User.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .select('-__v'),
        User.countDocuments(query),
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalUsers / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({
        success: true,
        data: users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalUsers,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
        },
      });

    } catch (error) {
      logger.error('Error fetching users:', error);
      next(error);
    }
  }

  /**
   * Get user by ID
   * @route GET /api/users/:id
   */
  async getUserById(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findById(id).select('-__v');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      res.json({
        success: true,
        data: user.toJSON(),
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      logger.error('Error fetching user:', error);
      next(error);
    }
  }

  /**
   * Update user by ID
   * @route PUT /api/users/:id
   */
  async updateUser(req, res, next) {
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

      // Find user
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if email is being changed and is unique
      if (updateData.email && updateData.email !== user.email) {
        const existingUser = await User.findByEmail(updateData.email);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Email is already in use',
          });
        }
      }

      // Check if username is being changed and is unique
      if (updateData.username && updateData.username !== user.username) {
        const existingUsername = await User.findByUsername(updateData.username);
        if (existingUsername) {
          return res.status(409).json({
            success: false,
            message: 'Username is already taken',
          });
        }
      }

      // Update user
      Object.assign(user, updateData);
      await user.save();

      logger.info(`User updated successfully: ${user.email}`);

      res.json({
        success: true,
        message: 'User updated successfully',
        data: user.toJSON(),
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      logger.error('Error updating user:', error);
      next(error);
    }
  }

  /**
   * Delete user by ID
   * @route DELETE /api/users/:id
   */
  async deleteUser(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      // Check if user has posts or comments
      const Post = require('../models/Post');
      const Comment = require('../models/Comment');

      const [postCount, commentCount] = await Promise.all([
        Post.countDocuments({ userId: id }),
        Comment.countDocuments({ userId: id }),
      ]);

      if (postCount > 0 || commentCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Cannot delete user with existing posts or comments',
          details: {
            posts: postCount,
            comments: commentCount,
          },
        });
      }

      await User.findByIdAndDelete(id);

      logger.info(`User deleted successfully: ${user.email}`);

      res.json({
        success: true,
        message: 'User deleted successfully',
        data: {
          id: user._id,
          email: user.email,
          deletedAt: new Date().toISOString(),
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      logger.error('Error deleting user:', error);
      next(error);
    }
  }

  /**
   * Get user's posts
   * @route GET /api/users/:id/posts
   */
  async getUserPosts(req, res, next) {
    try {
      const { id } = req.params;
      const {
        page = 1,
        limit = 10,
        status = 'published',
      } = req.query;

      // Check if user exists
      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const Post = require('../models/Post');

      // Parse pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query = { userId: id };
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

      logger.error('Error fetching user posts:', error);
      next(error);
    }
  }

  /**
   * Get user statistics
   * @route GET /api/users/:id/stats
   */
  async getUserStats(req, res, next) {
    try {
      const { id } = req.params;

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const Post = require('../models/Post');
      const Comment = require('../models/Comment');

      // Get detailed statistics
      const [
        totalPosts,
        publishedPosts,
        draftPosts,
        totalComments,
        recentPosts,
      ] = await Promise.all([
        Post.countDocuments({ userId: id }),
        Post.countDocuments({ userId: id, status: 'published' }),
        Post.countDocuments({ userId: id, status: 'draft' }),
        Comment.countDocuments({ userId: id }),
        Post.countDocuments({
          userId: id,
          createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }),
      ]);

      const stats = {
        user: user.getPublicProfile(),
        content: {
          totalPosts,
          publishedPosts,
          draftPosts,
          totalComments,
          recentPosts, // Last 30 days
        },
        account: {
          joinDate: user.createdAt,
          lastActivity: user.stats.lastActivity,
          accountAge: user.accountAge,
          isActive: user.isActive,
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
          message: 'Invalid user ID format',
        });
      }

      logger.error('Error fetching user stats:', error);
      next(error);
    }
  }

  /**
   * Search users
   * @route GET /api/users/search
   */
  async searchUsers(req, res, next) {
    try {
      const {
        q: searchTerm = '',
        page = 1,
        limit = 10,
        status = 'active',
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
      };

      const users = await User.searchUsers(searchTerm, options);
      const totalUsers = await User.countDocuments({
        $or: [
          { name: { $regex: searchTerm, $options: 'i' } },
          { username: { $regex: searchTerm, $options: 'i' } },
          { email: { $regex: searchTerm, $options: 'i' } },
        ],
        status,
      });

      const totalPages = Math.ceil(totalUsers / options.limit);

      res.json({
        success: true,
        data: users,
        search: {
          term: searchTerm,
          resultsCount: users.length,
          totalResults: totalUsers,
        },
        pagination: {
          currentPage: options.page,
          totalPages,
          totalItems: totalUsers,
          itemsPerPage: options.limit,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1,
        },
      });

    } catch (error) {
      logger.error('Error searching users:', error);
      next(error);
    }
  }

  /**
   * Update user status
   * @route PATCH /api/users/:id/status
   */
  async updateUserStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!status || !['active', 'inactive', 'suspended'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Valid status is required (active, inactive, suspended)',
        });
      }

      const user = await User.findById(id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      user.status = status;
      await user.save();

      logger.info(`User status updated: ${user.email} -> ${status}`);

      res.json({
        success: true,
        message: 'User status updated successfully',
        data: {
          id: user._id,
          email: user.email,
          status: user.status,
          updatedAt: user.updatedAt,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format',
        });
      }

      logger.error('Error updating user status:', error);
      next(error);
    }
  }

  /**
   * Sync users from external API
   * @route POST /api/users/sync
   */
  async syncUsers(req, res, next) {
    try {
      const syncService = require('../services/syncService');

      const result = await syncService.syncUsers();

      res.json({
        success: true,
        message: 'User synchronization completed',
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error syncing users:', error);
      next(error);
    }
  }
}

module.exports = new UserController();
