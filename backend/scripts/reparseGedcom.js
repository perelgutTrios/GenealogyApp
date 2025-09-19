// Script to reparse existing GEDCOM data
const mongoose = require('mongoose');
const { GedcomDatabase } = require('../models/Gedcom');
const User = require('../models/User');
const { decryptData, encryptData } = require('../utils/helpers');
const { getGedcomStats } = require('../utils/gedcomParser');
require('dotenv').config();

const reparseGedcomData = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all GEDCOM databases that need reparsing (have 0 individuals but should have data)
    const gedcomDbs = await GedcomDatabase.find({
      totalIndividuals: 0,
      sourceFile: { $ne: null } // Has a source file (uploaded GEDCOM)
    });

    console.log(`Found ${gedcomDbs.length} GEDCOM databases to reparse`);

    for (const gedcomDb of gedcomDbs) {
      try {
        console.log(`\nProcessing GEDCOM database: ${gedcomDb.databaseId}`);
        
        // Find the user
        const user = await User.findById(gedcomDb.userId);
        if (!user) {
          console.log('  - User not found, skipping');
          continue;
        }

        console.log(`  - User: ${user.email}`);

        // Decrypt existing data
        const encryptedData = JSON.parse(gedcomDb.encryptedData);
        const decryptedData = decryptData(encryptedData, user.encryptionKey);
        const gedcomData = JSON.parse(decryptedData);

        if (!gedcomData.rawGedcom) {
          console.log('  - No raw GEDCOM data found, skipping');
          continue;
        }

        console.log('  - Reparsing GEDCOM content...');
        const gedcomStats = getGedcomStats(gedcomData.rawGedcom);
        
        console.log(`  - Found ${gedcomStats.totalIndividuals} individuals and ${gedcomStats.totalFamilies} families`);

        // Update the GEDCOM data with parsed information
        gedcomData.individuals = gedcomStats.individuals;
        gedcomData.families = gedcomStats.families;
        gedcomData.parseSuccess = gedcomStats.success;
        gedcomData.parseError = gedcomStats.error || null;
        gedcomData.reparsedAt = new Date();

        // Re-encrypt the data
        const newEncryptedGedcom = encryptData(JSON.stringify(gedcomData), user.encryptionKey);

        // Update the database record
        gedcomDb.encryptedData = JSON.stringify(newEncryptedGedcom);
        gedcomDb.totalIndividuals = gedcomStats.totalIndividuals;
        gedcomDb.totalFamilies = gedcomStats.totalFamilies;
        gedcomDb.lastModified = new Date();

        await gedcomDb.save();
        
        console.log('  - Successfully updated!');

      } catch (error) {
        console.error(`  - Error processing ${gedcomDb.databaseId}:`, error.message);
      }
    }

    console.log('\nReparsing complete!');
    
  } catch (error) {
    console.error('Script error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the script
reparseGedcomData();