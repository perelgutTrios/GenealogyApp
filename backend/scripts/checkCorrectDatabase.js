const mongoose = require('mongoose');
const User = require('../models/User');

async function checkCorrectDatabase() {
  try {
    // Connect to the genealogy-db database instead of genealogy
    await mongoose.connect('mongodb://localhost:27017/genealogy-db');
    console.log('Connected to genealogy-db database');

    // Check collections in genealogy-db database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n=== COLLECTIONS IN GENEALOGY-DB DATABASE ===');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });

    // Check users collection
    const userCount = await User.countDocuments();
    console.log(`\n=== USER COUNT in genealogy-db: ${userCount} ===`);

    if (userCount > 0) {
      const users = await User.find({}).select('email hasGedcomFile createdAt encryptionKey');
      console.log('Users found:');
      users.forEach(user => {
        console.log(`  - ${user.email} (GEDCOM: ${user.hasGedcomFile}) - Created: ${user.createdAt}`);
        console.log(`    Has encryption key: ${!!user.encryptionKey}`);
      });
    }

    // Check document counts in all collections
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`${col.name}: ${count} documents`);
    }

    await mongoose.disconnect();
    console.log('\nDatabase check complete');
  } catch (error) {
    console.error('Database check error:', error);
  }
}

checkCorrectDatabase();