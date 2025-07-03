const express = require('express');
const { body, param, query } = require('express-validator');
const postController = require('../controllers/postController');
const { handleValidationErrors } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PostInput:
 *       type: object
 *       required:
 *         - title
 *         - body
 *         - userId
 *       properties:
 *         title:
 *           type: string
 *           minLength: 5
 *           maxLength: 200
 *           example: "My First Blog Post"
 *         body:
 *           type: string
 *           minLength: 10
 *           maxLength: 10000
 *           example: "This is the content of my first blog post..."
 *         userId:
 *           type: string
 *           format: objectId
 *           example: "507f1f77bcf86cd799439011"
 *         excerpt:
 *           type: string
 *           maxLength: 500
 *           example: "A brief summary of the post..."
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           example: ["technology", "programming"]
 *         category:
 *           type: string
 *           maxLength: 100
 *           example: "Technology"
 *         status:
 *           type: string
 *           enum: [draft, published, archived, deleted]
 *           default: published
 *         visibility:
 *           type: string
 *           enum: [public, private, unlisted]
 *           default: public
 *         featuredImage:
 *           type: object
 *           properties:
 *             url:
 *               type: string
 *               format: uri
 *             alt:
 *               type: string
 *             caption:
 *               type: string
 *         seo:
 *           type: object
 *           properties:
 *             metaTitle:
 *               type: string
 *               maxLength: 60
 *             metaDescription:
 *               type: string
 *               maxLength: 160
 *             keywords:
 *               type: array
 *               items:
 *                 type: string
 */

// Validation rules
const createPostValidation = [
  body('title')
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .trim(),
  body('body')
    .isLength({ min: 10, max: 10000 })
    .withMessage('Body must be between 10 and 10000 characters')
    .trim(),
  body('userId')
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('excerpt')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Excerpt cannot exceed 500 characters'),
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived', 'deleted'])
    .withMessage('Status must be draft, published, archived, or deleted'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Visibility must be public, private, or unlisted'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  body('tags.*')
    .optional()
    .isLength({ max: 50 })
    .withMessage('Each tag cannot exceed 50 characters'),
  body('seo.metaTitle')
    .optional()
    .isLength({ max: 60 })
    .withMessage('Meta title cannot exceed 60 characters'),
  body('seo.metaDescription')
    .optional()
    .isLength({ max: 160 })
    .withMessage('Meta description cannot exceed 160 characters'),
];

const updatePostValidation = [
  body('title')
    .optional()
    .isLength({ min: 5, max: 200 })
    .withMessage('Title must be between 5 and 200 characters')
    .trim(),
  body('body')
    .optional()
    .isLength({ min: 10, max: 10000 })
    .withMessage('Body must be between 10 and 10000 characters')
    .trim(),
  body('userId')
    .optional()
    .isMongoId()
    .withMessage('Valid user ID is required'),
  body('excerpt')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Excerpt cannot exceed 500 characters'),
  body('category')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Category cannot exceed 100 characters'),
  body('status')
    .optional()
    .isIn(['draft', 'published', 'archived', 'deleted'])
    .withMessage('Status must be draft, published, archived, or deleted'),
  body('visibility')
    .optional()
    .isIn(['public', 'private', 'unlisted'])
    .withMessage('Visibility must be public, private, or unlisted'),
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const idValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid post ID format'),
];

const userIdValidation = [
  param('userId')
    .isMongoId()
    .withMessage('Invalid user ID format'),
];

const slugValidation = [
  param('slug')
    .isLength({ min: 1 })
    .withMessage('Slug is required')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Slug can only contain lowercase letters, numbers, and hyphens'),
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

const tagValidation = [
  body('tag')
    .isLength({ min: 1, max: 50 })
    .withMessage('Tag must be between 1 and 50 characters')
    .trim(),
];

/**
 * @swagger
 * /api/posts:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PostInput'
 *     responses:
 *       201:
 *         description: Post created successfully
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
 *                   example: "Post created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/', createPostValidation, handleValidationErrors, postController.createPost);

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get all posts with pagination and filtering
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - $ref: '#/components/parameters/SortParam'
 *       - $ref: '#/components/parameters/SearchParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived, deleted]
 *         description: Filter by post status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
 *     responses:
 *       200:
 *         description: Posts retrieved successfully
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
 *                         $ref: '#/components/schemas/Post'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', paginationValidation, handleValidationErrors, postController.getPosts);

/**
 * @swagger
 * /api/posts/search:
 *   get:
 *     summary: Search posts
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/SearchParam'
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived, deleted]
 *         description: Filter by post status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filter by tags (comma-separated)
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
 *                         $ref: '#/components/schemas/Post'
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
router.get('/search', searchValidation, handleValidationErrors, postController.searchPosts);

/**
 * @swagger
 * /api/posts/trending:
 *   get:
 *     summary: Get trending posts
 *     tags: [Posts]
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 30
 *           default: 7
 *         description: Number of days for trending period
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Maximum number of posts to return
 *     responses:
 *       200:
 *         description: Trending posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                 meta:
 *                   type: object
 *                   properties:
 *                     timeframe:
 *                       type: string
 *                       example: "7 days"
 *                     count:
 *                       type: number
 *                       example: 10
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/trending', postController.getTrendingPosts);

/**
 * @swagger
 * /api/posts/sync:
 *   post:
 *     summary: Sync posts from external API
 *     tags: [Posts, Sync]
 *     responses:
 *       200:
 *         description: Post synchronization completed
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
 *                   example: "Post synchronization completed"
 *                 data:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: number
 *                       example: 15
 *                     updated:
 *                       type: number
 *                       example: 5
 *                     errors:
 *                       type: number
 *                       example: 0
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/sync', postController.syncPosts);

/**
 * @swagger
 * /api/posts/user/{userId}:
 *   get:
 *     summary: Get posts by user
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived, deleted]
 *         description: Filter by post status
 *     responses:
 *       200:
 *         description: User posts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                             name:
 *                               type: string
 *                             username:
 *                               type: string
 *                             email:
 *                               type: string
 *                         posts:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Post'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/user/:userId', userIdValidation, handleValidationErrors, postController.getPostsByUser);

/**
 * @swagger
 * /api/posts/slug/{slug}:
 *   get:
 *     summary: Get post by slug
 *     tags: [Posts]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Post slug
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Post'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/slug/:slug', slugValidation, handleValidationErrors, postController.getPostBySlug);

/**
 * @swagger
 * /api/posts/{id}:
 *   get:
 *     summary: Get post by ID
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Post retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Post'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', idValidation, handleValidationErrors, postController.getPostById);

/**
 * @swagger
 * /api/posts/{id}:
 *   put:
 *     summary: Update post by ID
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PostInput'
 *     responses:
 *       200:
 *         description: Post updated successfully
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
 *                   example: "Post updated successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Post'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/:id', [...idValidation, ...updatePostValidation], handleValidationErrors, postController.updatePost);

/**
 * @swagger
 * /api/posts/{id}:
 *   delete:
 *     summary: Delete post by ID
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Post deleted successfully
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
 *                   example: "Post deleted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     deletedAt:
 *                       type: string
 *                       format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Cannot delete post with existing comments
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
 *                   example: "Cannot delete post with existing comments"
 *                 details:
 *                   type: object
 *                   properties:
 *                     comments:
 *                       type: number
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete('/:id', idValidation, handleValidationErrors, postController.deletePost);

/**
 * @swagger
 * /api/posts/{id}/like:
 *   post:
 *     summary: Like a post
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Post liked successfully
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
 *                   example: "Post liked successfully"
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
router.post('/:id/like', idValidation, handleValidationErrors, postController.likePost);

/**
 * @swagger
 * /api/posts/{id}/tags:
 *   post:
 *     summary: Add tag to post
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tag
 *             properties:
 *               tag:
 *                 type: string
 *                 maxLength: 50
 *                 example: "javascript"
 *     responses:
 *       200:
 *         description: Tag added successfully
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
 *                   example: "Tag added successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     tags:
 *                       type: array
 *                       items:
 *                         type: string
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/tags', [...idValidation, ...tagValidation], handleValidationErrors, postController.addTag);

/**
 * @swagger
 * /api/posts/{id}/stats:
 *   get:
 *     summary: Get post statistics
 *     tags: [Posts]
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Post statistics retrieved successfully
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
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         views:
 *                           type: number
 *                         likes:
 *                           type: number
 *                         shares:
 *                           type: number
 *                         comments:
 *                           type: number
 *                         engagementRate:
 *                           type: number
 *                     content:
 *                       type: object
 *                       properties:
 *                         wordCount:
 *                           type: number
 *                         readingTime:
 *                           type: number
 *                         language:
 *                           type: string
 *                     meta:
 *                       type: object
 *                       properties:
 *                         isRecent:
 *                           type: boolean
 *                         isPublished:
 *                           type: boolean
 *                         publishedAt:
 *                           type: string
 *                           format: date-time
 *                         lastUpdated:
 *                           type: string
 *                           format: date-time
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id/stats', idValidation, handleValidationErrors, postController.getPostStats);

module.exports = router;
