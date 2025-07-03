const Comment = require('../models/Comment');
const Post = require('../models/Post');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');
const { createError } = require('../middleware/errorHandler');

/**
 * Comment Controller
 * Handles all comment-related operations
 */
class CommentController {
  /**
   * Create a new comment
   * @route POST /api/comments
   */
  async createComment(req, res, next) {
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

      const commentData = req.body;

      // Verify post exists
      const post = await Post.findById(commentData.postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      // Verify user exists if userId provided
      if (commentData.userId) {
        const user = await User.findById(commentData.userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found',
          });
        }
      }

      // Handle parent comment for replies
      if (commentData.parentId) {
        const parentComment = await Comment.findById(commentData.parentId);
        if (!parentComment) {
          return res.status(404).json({
            success: false,
            message: 'Parent comment not found',
          });
        }

        // Set depth based on parent
        commentData.depth = parentComment.depth + 1;

        // Prevent too deep nesting
        if (commentData.depth > 10) {
          return res.status(400).json({
            success: false,
            message: 'Comment nesting too deep',
          });
        }
      }

      // Create new comment
      const comment = new Comment({
        ...commentData,
        syncSource: 'manual',
        status: 'approved', // Auto-approve manual comments
      });

      await comment.save();

      // Update parent comment's replies array
      if (commentData.parentId) {
        await Comment.findByIdAndUpdate(commentData.parentId, {
          $push: { replies: comment._id },
          $inc: { 'stats.replies': 1 },
        });
      }

      // Update post's comment count
      await this.updatePostCommentCount(post._id);

      // Update user's comment count if applicable
      if (commentData.userId) {
        await this.updateUserCommentCount(commentData.userId);
      }

      logger.info(`Comment created successfully by: ${comment.name}`);

      res.status(201).json({
        success: true,
        message: 'Comment created successfully',
        data: comment.toJSON(),
      });

    } catch (error) {
      logger.error('Error creating comment:', error);
      next(error);
    }
  }

  /**
   * Get all comments with pagination and filtering
   * @route GET /api/comments
   */
  async getComments(req, res, next) {
    try {
      const {
        page = 1,
        limit = 10,
        sort = 'createdAt:desc',
        search = '',
        status = '',
        postId = '',
        userId = '',
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
          { body: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      // Add filters
      if (status) query.status = status;
      if (postId) query.postId = postId;
      if (userId) query.userId = userId;

      // Execute query
      const [comments, totalComments] = await Promise.all([
        Comment.find(query)
          .populate('postId', 'title slug')
          .populate('userId', 'name username')
          .populate('parentId', 'name body')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .select('-__v'),
        Comment.countDocuments(query),
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalComments / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.json({
        success: true,
        data: comments,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalItems: totalComments,
          itemsPerPage: limitNum,
          hasNextPage,
          hasPrevPage,
        },
      });

    } catch (error) {
      logger.error('Error fetching comments:', error);
      next(error);
    }
  }

  /**
   * Get comment by ID
   * @route GET /api/comments/:id
   */
  async getCommentById(req, res, next) {
    try {
      const { id } = req.params;

      const comment = await Comment.findById(id)
        .populate('postId', 'title slug')
        .populate('userId', 'name username')
        .populate('parentId', 'name body')
        .populate('replies', 'name body createdAt')
        .select('-__v');

      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      res.json({
        success: true,
        data: comment.toJSON(),
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID format',
        });
      }

      logger.error('Error fetching comment:', error);
      next(error);
    }
  }

  /**
   * Update comment by ID
   * @route PUT /api/comments/:id
   */
  async updateComment(req, res, next) {
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

      // Find comment
      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      // Verify post exists if postId is being updated
      if (updateData.postId && updateData.postId !== comment.postId.toString()) {
        const post = await Post.findById(updateData.postId);
        if (!post) {
          return res.status(404).json({
            success: false,
            message: 'Post not found',
          });
        }
      }

      // Verify user exists if userId is being updated
      if (updateData.userId && updateData.userId !== comment.userId?.toString()) {
        const user = await User.findById(updateData.userId);
        if (!user) {
          return res.status(404).json({
            success: false,
            message: 'User not found',
          });
        }
      }

      // Store original body for edit history
      const originalBody = comment.body;

      // Update comment
      Object.assign(comment, updateData);
      await comment.save();

      logger.info(`Comment updated successfully by: ${comment.name}`);

      res.json({
        success: true,
        message: 'Comment updated successfully',
        data: comment.toJSON(),
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID format',
        });
      }

      logger.error('Error updating comment:', error);
      next(error);
    }
  }

  /**
   * Delete comment by ID
   * @route DELETE /api/comments/:id
   */
  async deleteComment(req, res, next) {
    try {
      const { id } = req.params;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      // Check if comment has replies
      const replyCount = await Comment.countDocuments({ parentId: id });

      if (replyCount > 0) {
        return res.status(409).json({
          success: false,
          message: 'Cannot delete comment with existing replies',
          details: {
            replies: replyCount,
          },
        });
      }

      const postId = comment.postId;
      const userId = comment.userId;
      const parentId = comment.parentId;

      await Comment.findByIdAndDelete(id);

      // Update parent comment's replies array
      if (parentId) {
        await Comment.findByIdAndUpdate(parentId, {
          $pull: { replies: id },
          $inc: { 'stats.replies': -1 },
        });
      }

      // Update post's comment count
      await this.updatePostCommentCount(postId);

      // Update user's comment count if applicable
      if (userId) {
        await this.updateUserCommentCount(userId);
      }

      logger.info(`Comment deleted successfully by: ${comment.name}`);

      res.json({
        success: true,
        message: 'Comment deleted successfully',
        data: {
          id: comment._id,
          name: comment.name,
          deletedAt: new Date().toISOString(),
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID format',
        });
      }

      logger.error('Error deleting comment:', error);
      next(error);
    }
  }

  /**
   * Get comments by post
   * @route GET /api/comments/post/:postId
   */
  async getCommentsByPost(req, res, next) {
    try {
      const { postId } = req.params;
      const {
        page = 1,
        limit = 20,
        includeReplies = 'true',
        sort = 'createdAt:asc',
      } = req.query;

      // Check if post exists
      const post = await Post.findById(postId);
      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found',
        });
      }

      if (includeReplies === 'true') {
        // Get comments with nested structure
        const commentTree = await Comment.getCommentTree(postId);

        res.json({
          success: true,
          data: {
            post: post.getPublicData(),
            comments: commentTree,
          },
          meta: {
            total: commentTree.length,
            includeReplies: true,
          },
        });
      } else {
        // Get paginated flat list
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
        const skip = (pageNum - 1) * limitNum;

        // Parse sort
        const [sortField, sortOrder] = sort.split(':');
        const sortObj = {};
        sortObj[sortField] = sortOrder === 'desc' ? -1 : 1;

        const [comments, totalComments] = await Promise.all([
          Comment.findByPost(postId)
            .populate('userId', 'name username')
            .sort(sortObj)
            .skip(skip)
            .limit(limitNum),
          Comment.countDocuments({ postId, status: 'approved', visibility: 'public' }),
        ]);

        const totalPages = Math.ceil(totalComments / limitNum);

        res.json({
          success: true,
          data: {
            post: post.getPublicData(),
            comments,
          },
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalItems: totalComments,
            itemsPerPage: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
          },
        });
      }

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid post ID format',
        });
      }

      logger.error('Error fetching comments by post:', error);
      next(error);
    }
  }

  /**
   * Search comments
   * @route GET /api/comments/search
   */
  async searchComments(req, res, next) {
    try {
      const {
        q: searchTerm = '',
        page = 1,
        limit = 10,
        status = 'approved',
        postId = '',
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
        postId: postId || null,
      };

      const comments = await Comment.searchComments(searchTerm, options);

      // Count total results
      const query = { $text: { $search: searchTerm } };
      if (status) query.status = status;
      if (postId) query.postId = postId;

      const totalComments = await Comment.countDocuments(query);
      const totalPages = Math.ceil(totalComments / options.limit);

      res.json({
        success: true,
        data: comments,
        search: {
          term: searchTerm,
          resultsCount: comments.length,
          totalResults: totalComments,
        },
        pagination: {
          currentPage: options.page,
          totalPages,
          totalItems: totalComments,
          itemsPerPage: options.limit,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1,
        },
      });

    } catch (error) {
      logger.error('Error searching comments:', error);
      next(error);
    }
  }

  /**
   * Like a comment
   * @route POST /api/comments/:id/like
   */
  async likeComment(req, res, next) {
    try {
      const { id } = req.params;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      await comment.incrementLikes();

      res.json({
        success: true,
        message: 'Comment liked successfully',
        data: {
          id: comment._id,
          likes: comment.stats.likes,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID format',
        });
      }

      logger.error('Error liking comment:', error);
      next(error);
    }
  }

  /**
   * Report a comment
   * @route POST /api/comments/:id/report
   */
  async reportComment(req, res, next) {
    try {
      const { id } = req.params;
      const { reason = 'other' } = req.body;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      await comment.reportComment(reason);

      res.json({
        success: true,
        message: 'Comment reported successfully',
        data: {
          id: comment._id,
          reports: comment.stats.reports,
          status: comment.status,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID format',
        });
      }

      logger.error('Error reporting comment:', error);
      next(error);
    }
  }

  /**
   * Approve a comment
   * @route POST /api/comments/:id/approve
   */
  async approveComment(req, res, next) {
    try {
      const { id } = req.params;
      const { moderatorId } = req.body;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      await comment.approve(moderatorId);

      logger.info(`Comment approved by moderator: ${comment.name}`);

      res.json({
        success: true,
        message: 'Comment approved successfully',
        data: {
          id: comment._id,
          status: comment.status,
          moderatedAt: comment.moderation.moderatedAt,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID format',
        });
      }

      logger.error('Error approving comment:', error);
      next(error);
    }
  }

  /**
   * Reject a comment
   * @route POST /api/comments/:id/reject
   */
  async rejectComment(req, res, next) {
    try {
      const { id } = req.params;
      const { moderatorId, reason } = req.body;

      const comment = await Comment.findById(id);
      if (!comment) {
        return res.status(404).json({
          success: false,
          message: 'Comment not found',
        });
      }

      await comment.reject(moderatorId, reason);

      logger.info(`Comment rejected by moderator: ${comment.name}`);

      res.json({
        success: true,
        message: 'Comment rejected successfully',
        data: {
          id: comment._id,
          status: comment.status,
          moderatedAt: comment.moderation.moderatedAt,
          reason,
        },
      });

    } catch (error) {
      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid comment ID format',
        });
      }

      logger.error('Error rejecting comment:', error);
      next(error);
    }
  }

  /**
   * Sync comments from external API
   * @route POST /api/comments/sync
   */
  async syncComments(req, res, next) {
    try {
      const syncService = require('../services/syncService');

      const result = await syncService.syncComments();

      res.json({
        success: true,
        message: 'Comment synchronization completed',
        data: result,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Error syncing comments:', error);
      next(error);
    }
  }

  /**
   * Helper method to update post comment count
   * @private
   */
  async updatePostCommentCount(postId) {
    try {
      const commentCount = await Comment.countDocuments({
        postId,
        status: 'approved',
        visibility: 'public'
      });
      await Post.findByIdAndUpdate(postId, {
        'stats.comments': commentCount,
      });
    } catch (error) {
      logger.error('Error updating post comment count:', error);
    }
  }

  /**
   * Helper method to update user comment count
   * @private
   */
  async updateUserCommentCount(userId) {
    try {
      const commentCount = await Comment.countDocuments({
        userId,
        status: 'approved',
        visibility: 'public'
      });
      await User.findByIdAndUpdate(userId, {
        'stats.commentCount': commentCount,
        'stats.lastActivity': new Date(),
      });
    } catch (error) {
      logger.error('Error updating user comment count:', error);
    }
  }
}

module.exports = new CommentController();
