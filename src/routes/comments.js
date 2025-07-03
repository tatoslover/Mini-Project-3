const express = require('express');
const { body, param, query } = require('express-validator');
const commentController = require('../controllers/commentController');
const { handleValidationErrors } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CommentInput:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - body
 *         - postId
 *       properties:
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           example: "Jane Smith"
 *         email:
 *           type: string
 *           format: email
 *           example: "jane.smith@example.com"
 *         body:
 *           type: string
 *           minLength: 5
 *           maxLength: 1000
 *           example: "Great post! Thanks for sharing."
 *         postId:
 *           type: string
 *           format: objectId
 *           example: "507f1f77bcf86cd799439012"
 *         userId:
 *           type: string
 *           format: objectId
 *           example: "507f1f77bcf86cd799439011"
 *         parentId:
 *           type: string
 *           format: objectId
 *           example: "507f1f77bcf86cd799439013"
 *         status:
 *           type: string
 *           enum: [pending, approved, rejected, spam, deleted]
 *           default: approved
 *         visibility:
 *           type: string
 *           enum: [public, private, hidden]
 *           default: public
 *         author:
 *           type: object
 *           properties:
 *             website:
 *               type: string
 *               format: uri
 *             avatar:
 *               type: string
 *               format: uri
 */

// Validation rules
const createCommentValidation = [
  body('name')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('body')
    .isLength({ min: 5, max: 1000 })
    .withMessage('Comment body must be between 5 and 1000 characters')
    .trim(),
  body('postId')
    .isMongoId()
    .withMessage('Valid post ID is required'),
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('parentId')
    .optional()
    .isMongoId()
    .withMessage('Valid parent comment ID is required'),
  body('author.website')
    .optional()
    .isURL()
    .withMessage('Please provide a valid website URL'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'spam', 'deleted'])
    .withMessage('Status must be pending, approved, rejected, spam, or deleted'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'hidden'])
    .withMessage('Visibility must be public, private, or hidden'),
];

const updateCommentValidation = [
  body('name')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters')
    .trim(),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('body')
    .optional()
    .isLength({ min: 5, max: 1000 })
    .withMessage('Comment body must be between 5 and 1000 characters')
    .trim(),
  body('postId')
    .optional()
    .isMongoId()
    .withMessage('Valid post ID is required'),
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('status')
    .optional()
    .isIn(['pending', 'approved', 'rejected', 'spam', 'deleted'])
    .withMessage('Status must be pending, approved, rejected, spam, or deleted'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'hidden'])
    .withMessage('Visibility must be public, private, or hidden'),
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid comment ID format'),
];

const postIdValidation = [
  param('postId')
    .isMongoId()
    .withMessage('Invalid post ID format'),
];

const searchValidation = [
  query('q')
    .isLength({ min: 1 })
    .withMessage('Search term is required'),
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
];

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('sort')
    .optional()
    .matches(/^[a-zA-Z]+:(asc|desc)$/)
    .withMessage('Sort format must be field:direction (e.g., createdAt:desc)'),
];

const moderationValidation = [
  body('moderatorId')
    .isMongoId()
    .withMessage('Valid moderator ID is required'),
  body('reason')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Reason cannot exceed 500 characters'),
];

const reportValidation = [
  body('reason')
    .optional()
    .isIn(['spam', 'inappropriate', 'offensive', 'off-topic', 'other'])
    .withMessage('Reason must be spam, inappropriate, offensive, off-topic, or other'),
];

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Comment'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: Post or parent comment not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/', createCommentValidation, handleValidationErrors, commentController.createComment);

/**
 * @swagger
 * /api/comments:
 *   get:
 *     summary: Get all comments with pagination and filtering
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SortParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, spam, deleted]
 *         description: Filter by comment status
 *       - in: query
 *         name: postId
 *         schema:
 *           type: string
 *         description: Filter by post ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: Comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Comment'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', paginationValidation, handleValidationErrors, commentController.getComments);

/**
 * @swagger
 * /api/comments/search:
 *   get:
 *     summary: Search comments
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/SearchParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected, spam, deleted]
 *         description: Filter by comment status
 *       - in: query
 *         name: postId
 *         schema:
 *           type: string
 *         description: Filter by post ID
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Comment'
 *                     search:
 *                       type: object
 *                       properties:
 *                         term:
 *                           type: string
 *                         resultsCount:
 *                           type: number
 *                         totalResults:
 *                           type: number
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/search', searchValidation, handleValidationErrors, commentController.searchComments);

/**
 * @swagger
 * /api/comments/sync:
 *   post:
 *     summary: Sync comments from external API
 *     tags: [Comments, Sync]
 *     responses:
 *       200:
 *         description: Comment synchronization completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment synchronization completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: number
 *                       example: 50
 *                     updated:
 *                       type: number
 *                       example: 10
 *                     errors:
 *                       type: number
 *                       example: 0
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/sync', commentController.syncComments);

/**
 * @swagger
 * /api/comments/post/{postId}:
 *   get:
 *     summary: Get comments by post
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: postId
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: includeReplies
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: true
 *         description: Include nested replies in tree structure
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: "createdAt:asc"
 *         description: Sort order for comments
 *     responses:
 *       200:
 *         description: Post comments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     post:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         body:
 *                           type: string
 *                     comments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Comment'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginatedResponse/properties/pagination'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/post/:postId', postIdValidation, handleValidationErrors, commentController.getCommentsByPost);

/**
 * @swagger
 * /api/comments/{id}:
 *   get:
 *     summary: Get comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Comment retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Comment'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', idValidation, handleValidationErrors, commentController.getCommentById);

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CommentInput'
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Comment'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/:id', [...idValidation, ...updateCommentValidation], handleValidationErrors, commentController.updateComment);

/**
 * @swagger
 * /api/comments/{id}:
 *   delete:
 *     summary: Delete comment by ID
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot delete comment with existing replies
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Cannot delete comment with existing replies"
 *                 details:
 *                   type: object
 *                   properties:
 *                     replies:
 *                       type: number
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete('/:id', idValidation, handleValidationErrors, commentController.deleteComment);

/**
 * @swagger
 * /api/comments/{id}/like:
 *   post:
 *     summary: Like a comment
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Comment liked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment liked successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     likes:
 *                       type: number
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/like', idValidation, handleValidationErrors, commentController.likeComment);

/**
 * @swagger
 * /api/comments/{id}/report:
 *   post:
 *     summary: Report a comment
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 enum: [spam, inappropriate, offensive, off-topic, other]
 *                 default: other
 *     responses:
 *       200:
 *         description: Comment reported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment reported successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     reports:
 *                       type: number
 *                     status:
 *                       type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/report', [...idValidation, ...reportValidation], handleValidationErrors, commentController.reportComment);

/**
 * @swagger
 * /api/comments/{id}/approve:
 *   post:
 *     summary: Approve a comment (moderation)
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - moderatorId
 *             properties:
 *               moderatorId:
 *                 type: string
 *                 format: objectId
 *     responses:
 *       200:
 *         description: Comment approved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment approved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                     moderatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/approve', [...idValidation, ...moderationValidation], handleValidationErrors, commentController.approveComment);

/**
 * @swagger
 * /api/comments/{id}/reject:
 *   post:
 *     summary: Reject a comment (moderation)
 *     tags: [Comments]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - moderatorId
 *             properties:
 *               moderatorId:
 *                 type: string
 *                 format: objectId
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Comment rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Comment rejected successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     status:
 *                       type: string
 *                     moderatedAt:
 *                       type: string
 *                       format: date-time
 *                     reason:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/reject', [...idValidation, ...moderationValidation], handleValidationErrors, commentController.rejectComment);

module.exports = router;
