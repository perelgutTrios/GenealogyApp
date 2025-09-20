const mongoose = require('mongoose');

async function checkGenealogyDb() {
  try {
    await mongoose.connect('mongodb://localhost:27017/genealogy-db');
    console.log('Connected to genealogy-db');
    
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n=== COLLECTIONS IN GENEALOGY-DB ===');
    
    for (const col of collections) {
      const count = await mongoose.connection.db.collection(col.name).countDocuments();
      console.log(`\n${col.name}: ${count} documents`);
      
      if (count > 0 && count < 100) {
        // Show all documents for small collections
        const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
        docs.forEach((doc, i) => {
          console.log(`  Doc ${i + 1}:`);
          console.log(`    _id: ${doc._id}`);
          
          if (doc.email) console.log(`    email: ${doc.email}`);
          if (doc.hasGedcomFile !== undefined) console.log(`    hasGedcomFile: ${doc.hasGedcomFile}`);
          if (doc.gedcomDatabaseId) console.log(`    gedcomDatabaseId: ${doc.gedcomDatabaseId}`);
          if (doc.encryptedData) console.log(`    encryptedData: ${typeof doc.encryptedData} (${doc.encryptedData.length} chars)`);
          if (doc.totalIndividuals !== undefined) console.log(`    totalIndividuals: ${doc.totalIndividuals}`);
          if (doc.totalFamilies !== undefined) console.log(`    totalFamilies: ${doc.totalFamilies}`);
          if (doc.databaseId) console.log(`    databaseId: ${doc.databaseId}`);
          
          console.log(`    All fields: ${Object.keys(doc).join(', ')}`);
        });
      } else if (count > 0) {
        // Show just one sample for large collections
        const sample = await mongoose.connection.db.collection(col.name).findOne();
        console.log(`  Sample document fields: ${Object.keys(sample).join(', ')}`);
        
        if (sample.encryptedData) {
          console.log(`  Has encrypted data: ${typeof sample.encryptedData} (${sample.encryptedData.length} chars)`);
        }
      }
    }

    await mongoose.disconnect();
    console.log('\nCheck complete');
  } catch (error) {
    console.error('Check error:', error);
  }
}

checkGenealogyDb();