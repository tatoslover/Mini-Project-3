const mongoose = require("mongoose");
const { Schema } = mongoose;

/**
 * Comment Schema
 * Represents comments from the external API with additional fields
 */
const commentSchema = new Schema(
  {
    // External API reference
    externalId: {
      type: Number,
      unique: true,
      sparse: true,
      index: true,
      description: "ID from external API (JSONPlaceholder)",
    },

    // Post reference
    postId: {
      type: Schema.Types.ObjectId,
      ref: "Post",
      required: [true, "Post ID is required"],
      index: true,
    },

    // External post ID for syncing
    externalPostId: {
      type: Number,
      index: true,
      description: "Post ID from external API",
    },

    // Comment content
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        "Please provide a valid email address",
      ],
      index: true,
    },

    body: {
      type: String,
      required: [true, "Comment body is required"],
      trim: true,
      minlength: [5, "Comment must be at least 5 characters long"],
      maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },

    // User reference (if registered user)
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    // Comment metadata
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "spam", "deleted"],
      default: "approved",
      index: true,
    },

    visibility: {
      type: String,
      enum: ["public", "private", "hidden"],
      default: "public",
      index: true,
    },

    // Threading support
    // Parent comment for replies
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
    },

    replies: [
      {
        type: Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    depth: {
      type: Number,
      default: 0,
      min: [0, "Depth cannot be negative"],
      max: [10, "Maximum reply depth is 10"],
    },

    // Engagement metrics
    stats: {
      likes: {
        type: Number,
        default: 0,
        min: [0, "Likes cannot be negative"],
      },
      dislikes: {
        type: Number,
        default: 0,
        min: [0, "Dislikes cannot be negative"],
      },
      replies: {
        type: Number,
        default: 0,
        min: [0, "Replies cannot be negative"],
      },
      reports: {
        type: Number,
        default: 0,
        min: [0, "Reports cannot be negative"],
      },
    },

    // Content analysis
    content: {
      wordCount: {
        type: Number,
        default: 0,
        min: [0, "Word count cannot be negative"],
      },
      language: {
        type: String,
        default: "en",
        match: [/^[a-z]{2}$/, "Language must be a 2-letter code"],
      },
      sentiment: {
        type: String,
        enum: ["positive", "negative", "neutral"],
        default: "neutral",
      },
      toxicity: {
        score: {
          type: Number,
          min: 0,
          max: 1,
          default: 0,
        },
        flagged: {
          type: Boolean,
          default: false,
        },
      },
    },

    // User information
    author: {
      name: String,
      email: String,
      website: {
        type: String,
        match: [
          /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
          "Please provide a valid website URL",
        ],
      },
      avatar: String,
      isVerified: {
        type: Boolean,
        default: false,
      },
    },

    // Technical metadata
    metadata: {
      ipAddress: {
        type: String,
        match: [
          /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
          "Please provide a valid IP address",
        ],
      },
      userAgent: String,
      source: {
        type: String,
        enum: ["web", "mobile", "api", "import"],
        default: "web",
      },
      location: {
        country: String,
        city: String,
        coordinates: {
          lat: Number,
          lng: Number,
        },
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
        ref: "User",
      },
      moderatedAt: Date,
      moderationNotes: String,
      autoModerated: {
        type: Boolean,
        default: false,
      },
      moderationFlags: [
        {
          type: String,
          enum: ["spam", "inappropriate", "offensive", "off-topic", "other"],
        },
      ],
    },

    // Notifications
    notifications: {
      emailSent: {
        type: Boolean,
        default: false,
      },
      emailSentAt: Date,
      subscribeToReplies: {
        type: Boolean,
        default: true,
      },
    },

    // Edit history
    editHistory: [
      {
        editedAt: {
          type: Date,
          default: Date.now,
        },
        originalBody: String,
        editReason: String,
        editedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],

    // Sync information
    syncedAt: {
      type: Date,
      description: "Last sync from external API",
    },

    syncSource: {
      type: String,
      enum: ["api", "manual", "import", "migration"],
      default: "api",
    },

    // Additional features
    features: {
      isEdited: {
        type: Boolean,
        default: false,
      },
      isPinned: {
        type: Boolean,
        default: false,
      },
      isHighlighted: {
        type: Boolean,
        default: false,
      },
      isFromAuthor: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes for better query performance
commentSchema.index({ postId: 1, status: 1 });
commentSchema.index({ email: 1, status: 1 });
commentSchema.index({ createdAt: -1 });
commentSchema.index({ "stats.likes": -1 });
commentSchema.index({ body: "text" }); // Text search

// Compound indexes
commentSchema.index({ postId: 1, parentId: 1, createdAt: 1 });
commentSchema.index({ status: 1, visibility: 1, createdAt: -1 });

// Virtual for comment age
commentSchema.virtual("age").get(function () {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  const diffMinutes = Math.floor(diffTime / (1000 * 60));

  if (diffMinutes < 60) {
    return `${diffMinutes} minutes ago`;
  } else if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)} hours ago`;
  } else {
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  }
});

// Virtual for engagement score
commentSchema.virtual("engagementScore").get(function () {
  return this.stats.likes - this.stats.dislikes + this.stats.replies * 2;
});

// Virtual to check if comment is recent (within 24 hours)
commentSchema.virtual("isRecent").get(function () {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return this.createdAt > oneDayAgo;
});

// Virtual to check if comment is a reply
commentSchema.virtual("isReply").get(function () {
  return this.parentId !== null && this.parentId !== undefined;
});

// Virtual for public visibility
commentSchema.virtual("isVisible").get(function () {
  return this.status === "approved" && this.visibility === "public";
});

// Pre-save middleware
commentSchema.pre("save", function (next) {
  // Calculate word count
  if (this.isModified("body")) {
    const words = this.body.split(/\s+/).filter((word) => word.length > 0);
    this.content.wordCount = words.length;
  }

  // Set author information from individual fields
  if (this.isModified("name") || this.isModified("email")) {
    this.author.name = this.name;
    this.author.email = this.email;
  }

  // Set depth based on parent
  if (this.isModified("parentId") && this.parentId) {
    // This would typically be handled in the controller
    // to avoid additional database queries in middleware
  }

  // Mark as edited if body was modified (but not on creation)
  if (!this.isNew && this.isModified("body")) {
    this.features.isEdited = true;

    // Add to edit history
    this.editHistory.push({
      editedAt: new Date(),
      originalBody: this.body,
      editReason: "Content updated",
    });
  }

  next();
});

// Static methods
commentSchema.statics.findByPost = function (postId) {
  return this.find({ postId, status: "approved", visibility: "public" }).sort({
    createdAt: 1,
  });
};

commentSchema.statics.findByExternalId = function (externalId) {
  return this.findOne({ externalId });
};

commentSchema.statics.findReplies = function (parentId) {
  return this.find({ parentId, status: "approved", visibility: "public" }).sort(
    { createdAt: 1 },
  );
};

commentSchema.statics.findByUser = function (userId) {
  return this.find({ userId, status: "approved", visibility: "public" }).sort({
    createdAt: -1,
  });
};

commentSchema.statics.findByEmail = function (email) {
  return this.find({ email: email.toLowerCase(), status: "approved" }).sort({
    createdAt: -1,
  });
};

commentSchema.statics.searchComments = function (searchTerm, options = {}) {
  const {
    page = 1,
    limit = 10,
    sort = { createdAt: -1 },
    status = "approved",
    visibility = "public",
    postId = null,
    userId = null,
  } = options;

  const query = {};

  // Add search conditions
  if (searchTerm) {
    query.$text = { $search: searchTerm };
  }

  // Add filters
  if (status) query.status = status;
  if (visibility) query.visibility = visibility;
  if (postId) query.postId = postId;
  if (userId) query.userId = userId;

  const skip = (page - 1) * limit;

  let queryBuilder = this.find(query);

  // Add text search score for sorting
  if (searchTerm) {
    queryBuilder = queryBuilder.select({ score: { $meta: "textScore" } });
    sort.score = { $meta: "textScore" };
  }

  return queryBuilder
    .populate("postId", "title slug")
    .populate("userId", "name username")
    .populate("parentId", "name body")
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .exec();
};

commentSchema.statics.getCommentTree = function (postId) {
  return this.find({ postId, status: "approved", visibility: "public" })
    .populate("userId", "name username")
    .sort({ createdAt: 1 })
    .exec()
    .then((comments) => {
      // Build comment tree structure
      const commentMap = new Map();
      const rootComments = [];

      // First pass: create map of all comments
      comments.forEach((comment) => {
        commentMap.set(comment._id.toString(), {
          ...comment.toObject(),
          replies: [],
        });
      });

      // Second pass: build tree structure
      comments.forEach((comment) => {
        const commentObj = commentMap.get(comment._id.toString());

        if (comment.parentId) {
          const parent = commentMap.get(comment.parentId.toString());
          if (parent) {
            parent.replies.push(commentObj);
          }
        } else {
          rootComments.push(commentObj);
        }
      });

      return rootComments;
    });
};

// Instance methods
commentSchema.methods.incrementLikes = function () {
  this.stats.likes += 1;
  return this.save();
};

commentSchema.methods.incrementDislikes = function () {
  this.stats.dislikes += 1;
  return this.save();
};

commentSchema.methods.updateReplyCount = function (count) {
  this.stats.replies = Math.max(0, count);
  return this.save();
};

commentSchema.methods.reportComment = function (reason) {
  this.stats.reports += 1;
  this.moderation.moderationFlags.push(reason || "other");

  // Auto-hide if too many reports
  if (this.stats.reports >= 5) {
    this.status = "pending";
    this.moderation.autoModerated = true;
  }

  return this.save();
};

commentSchema.methods.approve = function (moderatorId) {
  this.status = "approved";
  this.moderation.isApproved = true;
  this.moderation.moderatedBy = moderatorId;
  this.moderation.moderatedAt = new Date();
  return this.save();
};

commentSchema.methods.reject = function (moderatorId, reason) {
  this.status = "rejected";
  this.moderation.isApproved = false;
  this.moderation.moderatedBy = moderatorId;
  this.moderation.moderatedAt = new Date();
  this.moderation.moderationNotes = reason;
  return this.save();
};

commentSchema.methods.getPublicData = function () {
  return {
    id: this._id,
    postId: this.postId,
    name: this.name,
    email: this.email,
    body: this.body,
    parentId: this.parentId,
    depth: this.depth,
    stats: this.stats,
    features: this.features,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

// Transform function for JSON output
commentSchema.set("toJSON", {
  transform: function (doc, ret) {
    // Remove sensitive fields
    delete ret.__v;
    delete ret.metadata;
    delete ret.moderation;
    delete ret.editHistory;
    delete ret.notifications;

    // Convert _id to id
    ret.id = ret._id;
    delete ret._id;

    return ret;
  },
});

const Comment = mongoose.model("Comment", commentSchema);

module.exports = Comment;
