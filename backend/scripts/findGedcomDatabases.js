const mongoose = require('mongoose');

async function findGedcomDatabases() {
  try {
    await mongoose.connect('mongodb://localhost:27017/admin');
    
    const admin = mongoose.connection.db.admin();
    const databases = await admin.listDatabases();
    
    console.log('\n=== ALL DATABASES ===');
    for (const db of databases.databases) {
      console.log(`${db.name} (${Math.round(db.sizeOnDisk/1024)} KB)`);
      
      // Check if it might be a GEDCOM database
      if (db.name.includes('gedcom') || db.name.includes('68cd') || db.sizeOnDisk > 1000000) {
        try {
          const testDb = mongoose.connection.useDb(db.name);
          const collections = await testDb.listCollections().toArray();
          
          console.log(`  Collections: ${collections.map(c => c.name).join(', ')}`);
          
          for (const col of collections) {
            const count = await testDb.collection(col.name).countDocuments();
            if (count > 0) {
              console.log(`    ${col.name}: ${count} docs`);
              const sample = await testDb.collection(col.name).findOne();
              
              if (sample) {
                console.log(`      Fields: ${Object.keys(sample).join(', ')}`);
                if (sample.encryptedData) {
                  console.log(`      Has encrypted data: ${typeof sample.encryptedData} (${sample.encryptedData.length} chars)`);
                }
                if (sample.totalIndividuals !== undefined) {
                  console.log(`      Total individuals: ${sample.totalIndividuals}`);
                }
                if (sample.totalFamilies !== undefined) {
                  console.log(`      Total families: ${sample.totalFamilies}`);
                }
              }
            }
          }
        } catch (e) {
          console.log(`    Error checking ${db.name}: ${e.message}`);
        }
      }
    }

    await mongoose.disconnect();
    console.log('\nSearch complete');
  } catch (error) {
    console.error('Search error:', error);
  }
}

findGedcomDatabases();