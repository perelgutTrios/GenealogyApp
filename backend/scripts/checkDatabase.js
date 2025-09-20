const mongoose = require('mongoose');
const User = require('../models/User');

async function checkDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/genealogy');
    console.log('Connected to MongoDB');

    // Check all databases
    const admin = mongoose.connection.db.admin();
    const databases = await admin.listDatabases();
    console.log('\n=== ALL DATABASES ===');
    databases.databases.forEach(db => {
      console.log(`- ${db.name} (${db.sizeOnDisk} bytes)`);
    });

    // Check collections in genealogy database
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n=== COLLECTIONS IN GENEALOGY DATABASE ===');
    collections.forEach(col => {
      console.log(`- ${col.name}`);
    });

    // Check users collection specifically
    const userCount = await User.countDocuments();
    console.log(`\n=== USER COUNT: ${userCount} ===`);

    if (userCount > 0) {
      const users = await User.find({}).select('email hasGedcomFile createdAt');
      console.log('Users found:');
      users.forEach(user => {
        console.log(`  - ${user.email} (GEDCOM: ${user.hasGedcomFile}) - Created: ${user.createdAt}`);
      });
    }

    // Check if there are any records in any collection
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

checkDatabase();