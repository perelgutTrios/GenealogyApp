const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },
  givenNames: {
    type: String,
    required: true,
    trim: true
  },
  familyNames: {
    type: String,
    required: true,
    trim: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: null
  },
  verificationExpires: {
    type: Date,
    default: null
  },
  gedcomDatabaseId: {
    type: String,
    unique: true,
    sparse: true // Allows multiple null values
  },
  encryptionKey: {
    type: String,
    required: true
  },
  hasGedcomFile: {
    type: Boolean,
    default: false
  },
  // Temporary data for verification process
  tempRegistrationData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // Store rejected record matches to avoid reshowing them
  rejectedMatches: [{
    personId: String,
    recordId: String, 
    reason: String,
    rejectedAt: { type: Date, default: Date.now },
    recordHash: String // Unique identifier for this person-record combination
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Generate unique GEDCOM database ID
userSchema.methods.generateGedcomDatabaseId = function() {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 15);
  return `gedcom_${this._id}_${timestamp}_${randomStr}`;
};

// Remove sensitive fields from JSON output
userSchema.methods.toJSON = function() {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verificationCode;
  delete userObject.encryptionKey;
  return userObject;
};

module.exports = mongoose.model('User', userSchema);