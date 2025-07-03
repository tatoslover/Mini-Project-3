const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Post Schema
 * Represents blog posts from the external API with additional fields
 */
const postSchema = new Schema({
  // External API reference
  externalId: {
    type: Number,
    unique: true,
    sparse: true,
    index: true,
    description: 'ID from external API (JSONPlaceholder)',
  },

  // Basic post information
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minlength: [5, 'Title must be at least 5 characters long'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
    index: true,
  },

  body: {
    type: String,
    required: [true, 'Body is required'],
    trim: true,
    minlength: [10, 'Body must be at least 10 characters long'],
    maxlength: [10000, 'Body cannot exceed 10000 characters'],
  },

  // User reference
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },

  // External user ID for syncing
  externalUserId: {
    type: Number,
    index: true,
    description: 'User ID from external API',
  },

  // Content metadata
  slug: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    lowercase: true,
    match: [/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'],
    index: true,
  },

  excerpt: {
    type: String,
    trim: true,
    maxlength: [500, 'Excerpt cannot exceed 500 characters'],
  },

  // Categorization
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
    maxlength: [50, 'Tag cannot exceed 50 characters'],
  }],

  category: {
    type: String,
    trim: true,
    maxlength: [100, 'Category cannot exceed 100 characters'],
    index: true,
  },

  // Status and visibility
  status: {
    type: String,
    enum: ['draft', 'published', 'archived', 'deleted'],
    default: 'published',
    index: true,
  },

  visibility: {
    type: String,
    enum: ['public', 'private', 'unlisted'],
    default: 'public',
    index: true,
  },

  // Publishing information
  publishedAt: {
    type: Date,
    index: true,
  },

  scheduledFor: {
    type: Date,
    index: true,
  },

  // Content features
  featuredImage: {
    url: String,
    alt: String,
    caption: String,
  },

  // SEO fields
  seo: {
    metaTitle: {
      type: String,
      trim: true,
      maxlength: [60, 'Meta title cannot exceed 60 characters'],
    },
    metaDescription: {
      type: String,
      trim: true,
      maxlength: [160, 'Meta description cannot exceed 160 characters'],
    },
    keywords: [{
      type: String,
      trim: true,
      lowercase: true,
    }],
  },

  // Engagement metrics
  stats: {
    views: {
      type: Number,
      default: 0,
      min: [0, 'Views cannot be negative'],
    },
    likes: {
      type: Number,
      default: 0,
      min: [0, 'Likes cannot be negative'],
    },
    shares: {
      type: Number,
      default: 0,
      min: [0, 'Shares cannot be negative'],
    },
    comments: {
      type: Number,
      default: 0,
      min: [0, 'Comments cannot be negative'],
    },
    averageReadTime: {
      type: Number,
      default: 0,
      min: [0, 'Average read time cannot be negative'],
    },
  },

  // Content analysis
  content: {
    wordCount: {
      type: Number,
      default: 0,
      min: [0, 'Word count cannot be negative'],
    },
    readingTime: {
      type: Number,
      default: 0,
      min: [0, 'Reading time cannot be negative'],
    },
    language: {
      type: String,
      default: 'en',
      match: [/^[a-z]{2}$/, 'Language must be a 2-letter code'],
    },
  },

  // Moderation
  moderation: {
    isApproved: {
      type: Boolean,
      default: true,
    },
    moderatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    moderatedAt: Date,
    moderationNotes: String,
  },

  // Version control
  version: {
    type: Number,
    default: 1,
    min: [1, 'Version must be at least 1'],
  },

  lastEditedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },

  editHistory: [{
    editedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    editedAt: {
      type: Date,
      default: Date.now,
    },
    changes: String,
    version: Number,
  }],

  // Sync information
  syncedAt: {
    type: Date,
    description: 'Last sync from external API',
  },

  syncSource: {
    type: String,
    enum: ['api', 'manual', 'import', 'migration'],
    default: 'api',
  },

  // Additional metadata
  metadata: {
    source: String,
    originalUrl: String,
    importedFrom: String,
    customFields: {
      type: Map,
      of: Schema.Types.Mixed,
    },
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
postSchema.index({ title: 'text', body: 'text' }); // Text search
postSchema.index({ userId: 1, status: 1 });
postSchema.index({ category: 1, status: 1 });
postSchema.index({ publishedAt: -1, status: 1 });
postSchema.index({ 'stats.views': -1 });
postSchema.index({ 'stats.likes': -1 });
postSchema.index({ createdAt: -1 });
postSchema.index({ updatedAt: -1 });
postSchema.index({ tags: 1 });

// Compound indexes
postSchema.index({ status: 1, visibility: 1, publishedAt: -1 });
postSchema.index({ userId: 1, createdAt: -1 });

// Virtual for URL-friendly slug
postSchema.virtual('url').get(function() {
  return this.slug ? `/posts/${this.slug}` : `/posts/${this._id}`;
});

// Virtual for published status
postSchema.virtual('isPublished').get(function() {
  return this.status === 'published' && this.visibility === 'public';
});

// Virtual for reading time in minutes
postSchema.virtual('readingTimeMinutes').get(function() {
  return Math.ceil(this.content.readingTime / 60) || 1;
});

// Virtual for engagement rate
postSchema.virtual('engagementRate').get(function() {
  if (this.stats.views === 0) return 0;
  const engagements = this.stats.likes + this.stats.shares + this.stats.comments;
  return Math.round((engagements / this.stats.views) * 100 * 100) / 100; // 2 decimal places
});

// Virtual to check if post is recent (within 7 days)
postSchema.virtual('isRecent').get(function() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return this.createdAt > sevenDaysAgo;
});

// Pre-save middleware
postSchema.pre('save', function(next) {
  // Generate slug if not provided
  if (this.isModified('title') && !this.slug) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');
  }

  // Generate excerpt if not provided
  if (this.isModified('body') && !this.excerpt) {
    this.excerpt = this.body.substring(0, 200).trim();
    if (this.body.length > 200) {
      this.excerpt += '...';
    }
  }

  // Calculate word count and reading time
  if (this.isModified('body')) {
    const words = this.body.split(/\s+/).filter(word => word.length > 0);
    this.content.wordCount = words.length;
    // Average reading speed: 200 words per minute
    this.content.readingTime = Math.ceil((words.length / 200) * 60); // in seconds
  }

  // Set publishedAt when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  // Increment version on content changes
  if (!this.isNew && (this.isModified('title') || this.isModified('body'))) {
    this.version += 1;
  }

  next();
});

// Static methods
postSchema.statics.findBySlug = function(slug) {
  return this.findOne({ slug });
};

postSchema.statics.findByExternalId = function(externalId) {
  return this.findOne({ externalId });
};

postSchema.statics.findPublished = function() {
  return this.find({ status: 'published', visibility: 'public' });
};

postSchema.statics.findByUser = function(userId) {
  return this.find({ userId });
};

postSchema.statics.findByCategory = function(category) {
  return this.find({ category, status: 'published', visibility: 'public' });
};

postSchema.statics.findByTag = function(tag) {
  return this.find({ tags: tag, status: 'published', visibility: 'public' });
};

postSchema.statics.searchPosts = function(searchTerm, options = {}) {
  const {
    page = 1,
    limit = 10,
    sort = { publishedAt: -1 },
    status = 'published',
    visibility = 'public',
    userId = null,
    category = null,
    tags = null,
  } = options;

  const query = {};

  // Add search conditions
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  // Add filters
  if (status) query.status = status;
  if (visibility) query.visibility = visibility;
  if (userId) query.userId = userId;
  if (category) query.category = category;
  if (tags) {
    if (Array.isArray(tags)) {
      query.tags = { $in: tags };
    } else {
      query.tags = tags;
    }
  }

  const skip = (page - 1) * limit;

  let queryBuilder = this.find(query);

  // Add text search score for sorting
  if (searchTerm) {
    queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } });
    sort.score = { $meta: 'textScore' };
  }

  return queryBuilder
    .populate('userId', 'name username email')
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .exec();
};

postSchema.statics.getTrendingPosts = function(days = 7, limit = 10) {
  const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  return this.find({
    status: 'published',
    visibility: 'public',
    publishedAt: { $gte: dateThreshold },
  })
    .sort({ 'stats.views': -1, 'stats.likes': -1 })
    .limit(limit)
    .populate('userId', 'name username')
    .exec();
};

// Instance methods
postSchema.methods.incrementViews = function() {
  this.stats.views += 1;
  return this.save();
};

postSchema.methods.incrementLikes = function() {
  this.stats.likes += 1;
  return this.save();
};

postSchema.methods.incrementShares = function() {
  this.stats.shares += 1;
  return this.save();
};

postSchema.methods.updateCommentCount = function(count) {
  this.stats.comments = Math.max(0, count);
  return this.save();
};

postSchema.methods.addTag = function(tag) {
  const normalizedTag = tag.toLowerCase().trim();
  if (!this.tags.includes(normalizedTag)) {
    this.tags.push(normalizedTag);
    return this.save();
  }
  return Promise.resolve(this);
};

postSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag.toLowerCase().trim());
  return this.save();
};

postSchema.methods.getPublicData = function() {
  return {
    id: this._id,
    title: this.title,
    body: this.body,
    excerpt: this.excerpt,
    slug: this.slug,
    category: this.category,
    tags: this.tags,
    status: this.status,
    publishedAt: this.publishedAt,
    stats: this.stats,
    content: this.content,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Transform function for JSON output
postSchema.set('toJSON', {
  transform: function(doc, ret) {
    // Remove sensitive fields
    delete ret.__v;
    delete ret.moderation;
    delete ret.editHistory;

    // Convert _id to id
    ret.id = ret._id;
    delete ret._id;

    return ret;
  },
});

const Post = mongoose.model('Post', postSchema);

module.exports = Post;
