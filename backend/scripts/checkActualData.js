const mongoose = require('mongoose');
const User = require('../models/User');

async function checkActualData() {
  try {
    // Connect to genealogy-db
    await mongoose.connect('mongodb://localhost:27017/genealogy-db');
    console.log('Connected to genealogy-db');

    // Check users
    const users = await User.find({});
    console.log(`\n=== USERS (${users.length}) ===`);
    
    for (const user of users) {
      console.log('\nUser:', user.email);
      console.log('- ID:', user._id);
      console.log('- Has GEDCOM file:', user.hasGedcomFile);
      console.log('- Has encryption key:', !!user.encryptionKey);
      console.log('- GEDCOM Database ID:', user.gedcomDatabaseId);
      
      // Check what databases exist for this user
      const admin = mongoose.connection.db.admin();
      const databases = await admin.listDatabases();
      
      const userDatabases = databases.databases.filter(db => 
        db.name.includes(user._id.toString())
      );
      
      console.log('- Related databases:', userDatabases.map(db => db.name));
      
      // Try different database patterns
      const patterns = [
        `gedcom_${user._id}`,
        `genealogy_${user._id}`,
        user.gedcomDatabaseId
      ];
      
      for (const dbName of patterns) {
        if (dbName) {
          try {
            const testDb = mongoose.connection.useDb(dbName);
            const collections = await testDb.listCollections().toArray();
            if (collections.length > 0) {
              console.log(`  - Database "${dbName}" exists with collections:`, collections.map(c => c.name));
              
              // Check each collection
              for (const col of collections) {
                const count = await testDb.collection(col.name).countDocuments();
                console.log(`    - ${col.name}: ${count} documents`);
                
                if (count > 0) {
                  const sample = await testDb.collection(col.name).findOne();
                  console.log(`    - Sample from ${col.name}:`, Object.keys(sample));
                  if (sample.encryptedData) {
                    console.log(`      - Has encryptedData: ${typeof sample.encryptedData} (length: ${sample.encryptedData.length})`);
                  }
                  if (sample.totalIndividuals) {
                    console.log(`      - Total individuals: ${sample.totalIndividuals}`);
                  }
                  if (sample.totalFamilies) {
                    console.log(`      - Total families: ${sample.totalFamilies}`);
                  }
                }
              }
            }
          } catch (dbError) {
            // Database doesn't exist, skip
          }
        }
      }
    }

    await mongoose.disconnect();
    console.log('\nCheck complete');
  } catch (error) {
    console.error('Check error:', error);
  }
}

checkActualData();