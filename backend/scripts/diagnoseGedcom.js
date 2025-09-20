const mongoose = require('mongoose');
const User = require('../models/User');
const { GedcomSchema } = require('../models/Gedcom');

async function diagnoseGedcomIssue() {
  try {
    await mongoose.connect('mongodb://localhost:27017/genealogy');
    console.log('Connected to MongoDB');

    // Find all users
    const users = await User.find({});
    console.log(`Found ${users.length} users`);

    for (const user of users) {
      console.log('\n=== USER DIAGNOSIS ===');
      console.log('User ID:', user._id);
      console.log('Email:', user.email);
      console.log('Has encryption key:', !!user.encryptionKey);
      console.log('Has GEDCOM file flag:', user.hasGedcomFile);
      
      // Check if user has a GEDCOM database
      const gedcomDbName = `gedcom_${user._id}`;
      console.log('Expected GEDCOM DB name:', gedcomDbName);
      
      try {
        const gedcomDb = mongoose.connection.useDb(gedcomDbName);
        const GedcomModel = gedcomDb.model('Gedcom', GedcomSchema);
        
        const gedcomData = await GedcomModel.findOne();
        if (gedcomData) {
          console.log('✅ GEDCOM data found');
          console.log('  - Created at:', gedcomData.createdAt);
          console.log('  - Updated at:', gedcomData.updatedAt);
          console.log('  - Has encrypted data:', !!gedcomData.encryptedData);
          console.log('  - Encrypted data type:', typeof gedcomData.encryptedData);
          console.log('  - Encrypted data length:', gedcomData.encryptedData ? gedcomData.encryptedData.length : 0);
          console.log('  - Total individuals:', gedcomData.totalIndividuals);
          console.log('  - Total families:', gedcomData.totalFamilies);
          
          // Try to decrypt if we have the key
          if (user.encryptionKey && gedcomData.encryptedData) {
            try {
              const { decryptData } = require('../utils/helpers');
              const decrypted = decryptData(gedcomData.encryptedData, user.encryptionKey);
              console.log('  - Decryption test: SUCCESS');
              console.log('  - Decrypted content length:', decrypted ? decrypted.length : 0);
              console.log('  - Content preview:', decrypted ? decrypted.substring(0, 100) + '...' : 'No content');
            } catch (decryptError) {
              console.log('  - Decryption test: FAILED -', decryptError.message);
            }
          }
        } else {
          console.log('❌ No GEDCOM data found in database');
        }
      } catch (dbError) {
        console.log('❌ Error accessing GEDCOM database:', dbError.message);
      }
    }

    await mongoose.disconnect();
    console.log('\nDiagnosis complete');
  } catch (error) {
    console.error('Diagnosis error:', error);
  }
}

diagnoseGedcomIssue();