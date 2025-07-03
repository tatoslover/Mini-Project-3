const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * User Schema
 * Represents users from the external API with additional fields
 */
const userSchema = new Schema({
  // External API reference
  externalId: {
    type: Number,
    unique: true,
    sparse: true,
    index: true,
    description: 'ID from external API (JSONPlaceholder)',
  },

  // Basic user information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    index: true,
  },

  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'Username must be at least 3 characters long'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
    index: true,
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [
      /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
      'Please provide a valid email address',
    ],
    index: true,
  },

  // Contact information
  phone: {
    type: String,
    trim: true,
    match: [/^[\d\s\-\+\(\)\.]+$/, 'Please provide a valid phone number'],
  },

  website: {
    type: String,
    trim: true,
    match: [
      /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      'Please provide a valid website URL',
    ],
  },

  // Address information
  address: {
    street: {
      type: String,
      trim: true,
      maxlength: [200, 'Street address cannot exceed 200 characters'],
    },
    suite: {
      type: String,
      trim: true,
      maxlength: [50, 'Suite cannot exceed 50 characters'],
    },
    city: {
      type: String,
      trim: true,
      maxlength: [100, 'City cannot exceed 100 characters'],
    },
    zipcode: {
      type: String,
      trim: true,
      maxlength: [20, 'Zipcode cannot exceed 20 characters'],
    },
    geo: {
      lat: {
        type: String,
        trim: true,
        match: [/^-?\d+\.?\d*$/, 'Please provide a valid latitude'],
      },
      lng: {
        type: String,
        trim: true,
        match: [/^-?\d+\.?\d*$/, 'Please provide a valid longitude'],
      },
    },
  },

  // Company information
  company: {
    name: {
      type: String,
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    catchPhrase: {
      type: String,
      trim: true,
      maxlength: [500, 'Catch phrase cannot exceed 500 characters'],
    },
    bs: {
      type: String,
      trim: true,
      maxlength: [500, 'Business description cannot exceed 500 characters'],
    },
  },

  // Additional fields for local functionality
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true,
  },

  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },

  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto',
    },
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    language: {
      type: String,
      default: 'en',
      match: [/^[a-z]{2}$/, 'Language must be a 2-letter code'],
    },
  },

  // Metadata
  tags: [{
    type: String,
    trim: true,
    maxlength: [50, 'Tag cannot exceed 50 characters'],
  }],

  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
  },

  // Statistics
  stats: {
    postCount: {
      type: Number,
      default: 0,
      min: [0, 'Post count cannot be negative'],
    },
    commentCount: {
      type: Number,
      default: 0,
      min: [0, 'Comment count cannot be negative'],
    },
    lastActivity: {
      type: Date,
      default: Date.now,
    },
  },

  // Sync information
  syncedAt: {
    type: Date,
    description: 'Last sync from external API',
  },

  syncSource: {
    type: String,
    enum: ['api', 'manual', 'import'],
    default: 'api',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// Indexes for better query performance
userSchema.index({ name: 1, email: 1 });
userSchema.index({ 'address.city': 1 });
userSchema.index({ 'company.name': 1 });
userSchema.index({ status: 1, role: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ 'stats.lastActivity': -1 });

// Virtual for full address
userSchema.virtual('fullAddress').get(function() {
  if (!this.address) return null;

  const parts = [];
  if (this.address.street) parts.push(this.address.street);
  if (this.address.suite) parts.push(this.address.suite);
  if (this.address.city) parts.push(this.address.city);
  if (this.address.zipcode) parts.push(this.address.zipcode);

  return parts.length > 0 ? parts.join(', ') : null;
});

// Virtual for full name with username
userSchema.virtual('displayName').get(function() {
  return `${this.name} (@${this.username})`;
});

// Virtual to check if user is active
userSchema.virtual('isActive').get(function() {
  return this.status === 'active';
});

// Virtual for age of account
userSchema.virtual('accountAge').get(function() {
  const now = new Date();
  const created = this.createdAt;
  const diffTime = Math.abs(now - created);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
});

// Pre-save middleware
userSchema.pre('save', function(next) {
  // Update lastActivity when user is modified
  if (this.isModified() && !this.isNew) {
    this.stats.lastActivity = new Date();
  }

  // Ensure username is lowercase
  if (this.isModified('username')) {
    this.username = this.username.toLowerCase();
  }

  // Ensure email is lowercase
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }

  next();
});

// Static methods
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByUsername = function(username) {
  return this.findOne({ username: username.toLowerCase() });
};

userSchema.statics.findByExternalId = function(externalId) {
  return this.findOne({ externalId });
};

userSchema.statics.findActive = function() {
  return this.find({ status: 'active' });
};

userSchema.statics.searchUsers = function(searchTerm, options = {}) {
  const {
    page = 1,
    limit = 10,
    sort = { createdAt: -1 },
    status = null,
  } = options;

  const query = {};

  // Add search conditions
  if (searchTerm) {
    query.$or = [
      { name: { $regex: searchTerm, $options: 'i' } },
      { username: { $regex: searchTerm, $options: 'i' } },
      { email: { $regex: searchTerm, $options: 'i' } },
    ];
  }

  // Add status filter
  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .exec();
};

// Instance methods
userSchema.methods.getPublicProfile = function() {
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    website: this.website,
    company: this.company,
    stats: this.stats,
    createdAt: this.createdAt,
  };
};

userSchema.methods.updateStats = function(updates) {
  if (updates.postCount !== undefined) {
    this.stats.postCount = Math.max(0, updates.postCount);
  }
  if (updates.commentCount !== undefined) {
    this.stats.commentCount = Math.max(0, updates.commentCount);
  }
  this.stats.lastActivity = new Date();
  return this.save();
};

userSchema.methods.addTag = function(tag) {
  if (!this.tags.includes(tag)) {
    this.tags.push(tag);
    return this.save();
  }
  return Promise.resolve(this);
};

userSchema.methods.removeTag = function(tag) {
  this.tags = this.tags.filter(t => t !== tag);
  return this.save();
};

// Transform function for JSON output
userSchema.set('toJSON', {
  transform: function(doc, ret) {
    // Remove sensitive fields
    delete ret.__v;

    // Convert _id to id
    ret.id = ret._id;
    delete ret._id;

    return ret;
  },
});

const User = mongoose.model('User', userSchema);

module.exports = User;
