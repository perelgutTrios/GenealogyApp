const express = require('express');
const { authMiddleware, requireVerified } = require('../middleware/auth');
const { GedcomDatabase } = require('../models/Gedcom');
const { decryptData } = require('../utils/helpers');

const router = express.Router();

// Get user's GEDCOM data
router.get('/data', authMiddleware, requireVerified, async (req, res) => {
  try {
    const gedcomDb = await GedcomDatabase.findOne({ userId: req.user._id });
    
    if (!gedcomDb) {
      return res.status(404).json({ message: 'GEDCOM database not found' });
    }

    // Decrypt the data
    const encryptedData = JSON.parse(gedcomDb.encryptedData);
    const decryptedData = decryptData(encryptedData, req.user.encryptionKey);
    const gedcomData = JSON.parse(decryptedData);

    res.json({
      database: {
        id: gedcomDb.databaseId,
        version: gedcomDb.gedcomVersion,
        sourceFile: gedcomDb.sourceFile,
        totalIndividuals: gedcomDb.totalIndividuals,
        totalFamilies: gedcomDb.totalFamilies,
        lastModified: gedcomDb.lastModified,
        createdAt: gedcomDb.createdAt
      },
      data: gedcomData
    });

  } catch (error) {
    console.error('Get GEDCOM data error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve GEDCOM data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get GEDCOM database stats
router.get('/stats', authMiddleware, requireVerified, async (req, res) => {
  try {
    const gedcomDb = await GedcomDatabase.findOne({ userId: req.user._id });
    
    if (!gedcomDb) {
      return res.status(404).json({ message: 'GEDCOM database not found' });
    }

    res.json({
      databaseId: gedcomDb.databaseId,
      version: gedcomDb.gedcomVersion,
      sourceFile: gedcomDb.sourceFile,
      totalIndividuals: gedcomDb.totalIndividuals,
      totalFamilies: gedcomDb.totalFamilies,
      lastModified: gedcomDb.lastModified,
      createdAt: gedcomDb.createdAt
    });

  } catch (error) {
    console.error('Get GEDCOM stats error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve GEDCOM statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;