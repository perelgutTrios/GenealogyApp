const mongoose = require('mongoose');

// Individual person in GEDCOM
const personSchema = new mongoose.Schema({
  gedcomId: {
    type: String,
    required: true
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
  birthDate: {
    type: String,
    default: null
  },
  birthPlace: {
    type: String,
    default: null
  },
  deathDate: {
    type: String,
    default: null
  },
  deathPlace: {
    type: String,
    default: null
  },
  sex: {
    type: String,
    enum: ['M', 'F', 'U'],
    default: 'U'
  },
  parents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GedcomPerson'
  }],
  spouse: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GedcomPerson'
  }],
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GedcomPerson'
  }],
  notes: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// GEDCOM database for each user
const gedcomDatabaseSchema = new mongoose.Schema({
  databaseId: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  encryptedData: {
    type: String, // Will contain encrypted JSON of all genealogy data
    required: true
  },
  gedcomVersion: {
    type: String,
    default: '7.0'
  },
  sourceFile: {
    type: String, // Original GEDCOM filename if uploaded
    default: null
  },
  totalIndividuals: {
    type: Number,
    default: 0
  },
  totalFamilies: {
    type: Number,
    default: 0
  },
  lastModified: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Update lastModified on save
gedcomDatabaseSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

const GedcomPerson = mongoose.model('GedcomPerson', personSchema);
const GedcomDatabase = mongoose.model('GedcomDatabase', gedcomDatabaseSchema);

module.exports = {
  GedcomPerson,
  GedcomDatabase
};