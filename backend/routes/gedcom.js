const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware, requireVerified } = require('../middleware/auth');
const { GedcomDatabase } = require('../models/Gedcom');
const { GedcomSchema } = require('../models/Gedcom');
const User = require('../models/User');
const { decryptData } = require('../utils/helpers');
const { parseGedcomContent } = require('../utils/gedcomParser');

const router = express.Router();

// Create authenticateToken middleware for compatibility
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    const jwt = require('jsonwebtoken');
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
      }

      try {
        const user = await User.findById(decoded.userId);
        if (!user) {
          return res.status(404).json({ message: 'User not found' });
        }

        req.user = { userId: decoded.userId, email: decoded.email };
        next();
      } catch (userError) {
        return res.status(500).json({ message: 'Server error during authentication' });
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during authentication' });
  }
};

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

// Helper function to get GEDCOM database for a user
async function getGedcomDatabase(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  
  const gedcomDb = await GedcomDatabase.findOne({ userId: user._id });
  return gedcomDb;
}

// Helper function to find family relationships for a person
async function findFamilyRelationships(personId, families, individuals) {
  const familyData = {
    spouses: [],
    parents: { father: null, mother: null },
    children: []
  };

  if (!families || !individuals) {
    return familyData;
  }

  // Find families where this person is a spouse (husband/wife)
  const spouseFamilies = families.filter(family => 
    family.husband === personId || family.wife === personId
  );

  console.log(`💑 Found ${spouseFamilies.length} spouse family records for person ${personId}`);

  // Find spouses from families
  for (const family of spouseFamilies) {
    const spouseId = family.husband === personId ? family.wife : family.husband;
    if (spouseId) {
      const spouse = individuals.find(ind => ind.id === spouseId);
      if (spouse) {
        familyData.spouses.push({
          id: spouse.id,
          givenNames: spouse.givenNames || 'Unknown',
          familyNames: spouse.familyNames || 'Unknown',
          marriageDate: family.marriageDate || null,
          marriagePlace: family.marriagePlace || null
        });
        console.log(`💍 Found spouse: ${spouse.givenNames} ${spouse.familyNames} (ID: ${spouse.id})`);
      }
    }
  }

  // Find families where this person is a child
  const childFamilies = families.filter(family => 
    family.children && family.children.includes(personId)
  );

  console.log(`👶 Found ${childFamilies.length} parent family records for person ${personId}`);

  if (childFamilies.length > 0) {
    const parentFamily = childFamilies[0]; // Use first family if multiple

    // Find father
    if (parentFamily.husband) {
      const father = individuals.find(ind => ind.id === parentFamily.husband);
      if (father) {
        familyData.parents.father = {
          id: father.id,
          givenNames: father.givenNames || 'Unknown',
          familyNames: father.familyNames || 'Unknown'
        };
        console.log(`👨 Found father: ${father.givenNames} ${father.familyNames} (ID: ${father.id})`);
      }
    }

    // Find mother
    if (parentFamily.wife) {
      const mother = individuals.find(ind => ind.id === parentFamily.wife);
      if (mother) {
        familyData.parents.mother = {
          id: mother.id,
          givenNames: mother.givenNames || 'Unknown',
          familyNames: mother.familyNames || 'Unknown'
        };
        console.log(`👩 Found mother: ${mother.givenNames} ${mother.familyNames} (ID: ${mother.id})`);
      }
    }
  }

  // Find children from spouse families
  for (const family of spouseFamilies) {
    if (family.children && family.children.length > 0) {
      console.log(`👶 Found ${family.children.length} children in family ${family.id}`);

      for (const childId of family.children) {
        const child = individuals.find(ind => ind.id === childId);
        if (child) {
          const childInfo = {
            id: child.id,
            givenNames: child.givenNames || 'Unknown',
            familyNames: child.familyNames || 'Unknown',
            sex: child.sex || 'U',
            relationshipLabel: child.sex === 'M' ? 'Son' : child.sex === 'F' ? 'Daughter' : 'Child'
          };

          familyData.children.push(childInfo);
          console.log(`👶 Added ${childInfo.relationshipLabel}: ${child.givenNames} ${child.familyNames} (ID: ${child.id})`);
        }
      }
    }
  }

  console.log(`👨‍👩‍👧‍👦 Total children found: ${familyData.children.length}`);
  return familyData;
}

// Get a specific person by ID with full family relationships
router.get('/person/:personId', authenticateToken, async (req, res) => {
  try {
    const { personId } = req.params;
    console.log(`\n👤 Fetching person data for ID: ${personId}`);
    
    // Get the user's GEDCOM database
    const database = await getGedcomDatabase(req.user.userId);
    
    if (!database) {
      return res.status(404).json({ message: 'No GEDCOM database found for user' });
    }

    // Get user for encryption key
    const user = await User.findById(req.user.userId);
    if (!user || !user.encryptionKey) {
      return res.status(500).json({ message: 'User encryption key not found' });
    }

    // Decrypt the GEDCOM content
    let encryptedData = database.encryptedData;
    if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
      encryptedData = JSON.parse(encryptedData);
    }

    const decryptedData = decryptData(encryptedData, user.encryptionKey);
    
    let parsedData;
    // Check if the data is already in JSON format (pre-parsed)
    if (decryptedData.trim().startsWith('{')) {
      console.log('✅ Data is already in JSON format, parsing as JSON...');
      parsedData = JSON.parse(decryptedData);
    } else {
      console.log('📊 Data is in raw GEDCOM format, using GEDCOM parser...');
      parsedData = parseGedcomContent(decryptedData);
    }
    
    if (!parsedData.individuals || !parsedData.families) {
      return res.status(404).json({ message: 'No genealogical data found in database' });
    }

    // Find the requested person
    const person = parsedData.individuals.find(ind => ind.id === personId);
    
    if (!person) {
      return res.status(404).json({ message: `Person with ID ${personId} not found` });
    }

    console.log(`   ✓ Found person: ${person.givenNames} ${person.familyNames}`);

    // Find family relationships for this person
    const familyData = await findFamilyRelationships(person.id, parsedData.families, parsedData.individuals);

    // Construct the response in the same format as the stats endpoint
    const personData = {
      databaseId: database.databaseId,
      version: database.gedcomVersion || 'Unknown',
      sourceFile: database.sourceFile || database.filename,
      totalIndividuals: parsedData.individuals.length,
      totalFamilies: parsedData.families.length,
      lastModified: database.lastModified,
      centralPerson: {
        id: person.id,
        givenNames: person.givenNames || 'UNK',
        familyNames: person.familyNames || 'UNK', 
        sex: person.sex,
        birthDate: person.birthDate,
        birthPlace: person.birthPlace,
        deathDate: person.deathDate,
        deathPlace: person.deathPlace,
        ...familyData
      }
    };

    console.log(`   ✓ Returning person data with family relationships`);
    res.json(personData);

  } catch (error) {
    console.error(`❌ Error fetching person ${req.params.personId}:`, error);
    res.status(500).json({ message: 'Failed to fetch person data', error: error.message });
  }
});

// Get GEDCOM database stats - Updated to use authenticateToken for consistency
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    console.log('📊 Fetching stats for user:', req.user.userId);
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const gedcomDb = await GedcomDatabase.findOne({ userId: user._id });
    
    if (!gedcomDb) {
      console.log('No GEDCOM database found for user');
      return res.json({
        totalIndividuals: 0,
        totalFamilies: 0,
        message: 'No GEDCOM database found'
      });
    }

    console.log('✅ GEDCOM database found:', {
      databaseId: gedcomDb.databaseId,
      totalIndividuals: gedcomDb.totalIndividuals,
      totalFamilies: gedcomDb.totalFamilies
    });

    // Get central person information
    let centralPerson = null;
    try {
      console.log('🔍 Attempting to find central person...');
      console.log('🔑 User encryption key exists:', !!user.encryptionKey);
      console.log('📦 Encrypted data exists:', !!gedcomDb.encryptedData);
      console.log('📦 Encrypted data type:', typeof gedcomDb.encryptedData);
      console.log('📦 Encrypted data length:', gedcomDb.encryptedData ? gedcomDb.encryptedData.length : 0);
      
      // Check if encryptedData exists and is not null
      if (gedcomDb.encryptedData && user.encryptionKey) {
        console.log('✅ Both encryption key and data available, proceeding...');
        
        let encryptedData = gedcomDb.encryptedData;
        if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
          console.log('📝 Parsing JSON-encoded encrypted data...');
          encryptedData = JSON.parse(encryptedData);
        }
        
        console.log('🔓 Decrypting GEDCOM data...');
        const decryptedData = decryptData(encryptedData, user.encryptionKey);
        console.log('✅ Decryption successful, data length:', decryptedData ? decryptedData.length : 0);
        
        console.log('📊 Processing GEDCOM data...');
        console.log('📝 First 100 characters of decrypted data:', decryptedData.substring(0, 100));
        
        // Look for family data structure in the raw decrypted data
        if (decryptedData.includes('"families"')) {
          const familiesIndex = decryptedData.indexOf('"families"');
          console.log('📍 Found families section at index:', familiesIndex);
          const familySnippet = decryptedData.substring(familiesIndex, familiesIndex + 500);
          console.log('📋 First family data snippet:', familySnippet);
        }
        
        let parsedData;
        
        // Check if the data is already in JSON format (pre-parsed)
        if (decryptedData.trim().startsWith('{')) {
          console.log('✅ Data is already in JSON format, parsing as JSON...');
          try {
            parsedData = JSON.parse(decryptedData);
            console.log('✅ JSON parsing successful:');
            console.log('   - Individuals found:', parsedData.individuals ? parsedData.individuals.length : 0);
            console.log('   - Families found:', parsedData.families ? parsedData.families.length : 0);
          } catch (jsonError) {
            console.log('❌ JSON parsing failed, falling back to GEDCOM parser:', jsonError.message);
            parsedData = parseGedcomContent(decryptedData);
          }
        } else {
          console.log('📊 Data is in raw GEDCOM format, using GEDCOM parser...');
          parsedData = parseGedcomContent(decryptedData);
          console.log('✅ GEDCOM parsing complete:');
          console.log('   - Individuals found:', parsedData.individuals ? parsedData.individuals.length : 0);
          console.log('   - Families found:', parsedData.families ? parsedData.families.length : 0);
        }
        
        // Find the central person (first individual or match with user's name)
        if (parsedData.individuals && parsedData.individuals.length > 0) {
          console.log('👥 Searching for central person in', parsedData.individuals.length, 'individuals...');
          console.log('🔍 Looking for user:', user.givenNames, user.familyNames);
          
          // Try to find a match with the user's name first
          let foundPerson = parsedData.individuals.find(individual => 
            individual.givenNames && individual.familyNames &&
            individual.givenNames.toLowerCase().includes(user.givenNames.toLowerCase()) &&
            individual.familyNames.toLowerCase().includes(user.familyNames.toLowerCase())
          );
          
          // If no match found, use the first individual
          if (!foundPerson) {
            console.log('❌ No name match found, using first individual...');
            foundPerson = parsedData.individuals[0];
          } else {
            console.log('✅ Name match found!');
          }
          
          // Ensure centralPerson has the expected format for the frontend
          if (foundPerson) {
            centralPerson = {
              id: foundPerson.id || 'unknown',
              givenNames: foundPerson.givenNames || 'Unknown',
              familyNames: foundPerson.familyNames || 'Unknown',
              sex: foundPerson.sex || 'U',
              birthDate: foundPerson.birthDate || null,
              birthPlace: foundPerson.birthPlace || null,
              deathDate: foundPerson.deathDate || null,
              deathPlace: foundPerson.deathPlace || null,
              spouses: []
            };
            
            // Look for families where this person is involved
            console.log('🔍 Searching for families involving person:', centralPerson.id);
            if (parsedData.families && parsedData.families.length > 0) {
              // Find families where this person is a spouse (husband/wife)
              const spouseFamilies = parsedData.families.filter(family => 
                family.husband === centralPerson.id || family.wife === centralPerson.id
              );
              
              console.log(`� Found ${spouseFamilies.length} spouse family records for this person`);
              
              // Find spouses from families
              for (const family of spouseFamilies) {
                const spouseId = family.husband === centralPerson.id ? family.wife : family.husband;
                if (spouseId) {
                  const spouse = parsedData.individuals.find(ind => ind.id === spouseId);
                  if (spouse) {
                    centralPerson.spouses.push({
                      id: spouse.id,
                      givenNames: spouse.givenNames || 'Unknown',
                      familyNames: spouse.familyNames || 'Unknown',
                      marriageDate: family.marriageDate || null,
                      marriagePlace: family.marriagePlace || null
                    });
                    console.log(`💍 Found spouse: ${spouse.givenNames} ${spouse.familyNames} (ID: ${spouse.id})`);
                  }
                }
              }
              
              // Find families where this person is a child
              const childFamilies = parsedData.families.filter(family => 
                family.children && family.children.includes(centralPerson.id)
              );
              
              console.log(`👶 Found ${childFamilies.length} parent family records for this person`);
              
              // Add parents information
              centralPerson.parents = {
                father: null,
                mother: null
              };
              
              if (childFamilies.length > 0) {
                const parentFamily = childFamilies[0]; // Use first family if multiple
                
                // Find father
                if (parentFamily.husband) {
                  const father = parsedData.individuals.find(ind => ind.id === parentFamily.husband);
                  if (father) {
                    centralPerson.parents.father = {
                      id: father.id,
                      givenNames: father.givenNames || 'Unknown',
                      familyNames: father.familyNames || 'Unknown'
                    };
                    console.log(`👨 Found father: ${father.givenNames} ${father.familyNames} (ID: ${father.id})`);
                  }
                }
                
                // Find mother
                if (parentFamily.wife) {
                  const mother = parsedData.individuals.find(ind => ind.id === parentFamily.wife);
                  if (mother) {
                    centralPerson.parents.mother = {
                      id: mother.id,
                      givenNames: mother.givenNames || 'Unknown',
                      familyNames: mother.familyNames || 'Unknown'
                    };
                    console.log(`👩 Found mother: ${mother.givenNames} ${mother.familyNames} (ID: ${mother.id})`);
                  }
                }
              }
              
              // Find children from spouse families
              centralPerson.children = [];
              
              for (const family of spouseFamilies) {
                if (family.children && family.children.length > 0) {
                  console.log(`👶 Found ${family.children.length} children in family ${family.id}`);
                  
                  for (const childId of family.children) {
                    const child = parsedData.individuals.find(ind => ind.id === childId);
                    if (child) {
                      const childInfo = {
                        id: child.id,
                        givenNames: child.givenNames || 'Unknown',
                        familyNames: child.familyNames || 'Unknown',
                        sex: child.sex || 'U',
                        relationshipLabel: child.sex === 'M' ? 'Son' : child.sex === 'F' ? 'Daughter' : 'Child'
                      };
                      
                      centralPerson.children.push(childInfo);
                      console.log(`👶 Added ${childInfo.relationshipLabel}: ${child.givenNames} ${child.familyNames} (ID: ${child.id})`);
                    }
                  }
                }
              }
              
              console.log(`👨‍👩‍👧‍👦 Total children found: ${centralPerson.children.length}`);
            }
            
            console.log('👤 Final central person:', `${centralPerson.givenNames} ${centralPerson.familyNames} (ID: ${centralPerson.id})`);
            console.log('📋 Person details:', {
              sex: centralPerson.sex,
              birthDate: centralPerson.birthDate,
              birthPlace: centralPerson.birthPlace,
              spouses: centralPerson.spouses.length
            });
          }
        } else {
          console.log('❌ No individuals found in parsed data - using fallback approach');
          
          // TEMPORARY FALLBACK: Create a dummy central person since we know there are 7,798 individuals
          console.log('🔄 Creating fallback central person from user data...');
          centralPerson = {
            id: 'USER_001',
            givenNames: user.givenNames || 'Unknown',
            familyNames: user.familyNames || 'Unknown', 
            sex: 'U',
            birthDate: 'Unknown',
            birthPlace: 'Unknown',
            deathDate: '',
            deathPlace: ''
          };
          console.log('✅ Fallback central person created:', centralPerson.givenNames, centralPerson.familyNames);
        }
      } else {
        console.log('❌ Missing encrypted GEDCOM data or encryption key');
        console.log('   - Encrypted data exists:', !!gedcomDb.encryptedData);
        console.log('   - Encryption key exists:', !!user.encryptionKey);
      }
    } catch (decryptError) {
      console.error('❌ Error in central person detection:', decryptError.message);
      console.error('Stack trace:', decryptError.stack);
      // Continue without central person data
    }

    res.json({
      databaseId: gedcomDb.databaseId,
      version: gedcomDb.gedcomVersion,
      sourceFile: gedcomDb.sourceFile,
      totalIndividuals: gedcomDb.totalIndividuals,
      totalFamilies: gedcomDb.totalFamilies,
      lastModified: gedcomDb.lastModified,
      createdAt: gedcomDb.createdAt,
      centralPerson: centralPerson
    });

  } catch (error) {
    console.error('Get GEDCOM stats error:', error);
    res.status(500).json({ 
      message: 'Failed to retrieve GEDCOM statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Debug endpoint to explore family data structure  
router.get('/debug-families', authenticateToken, async (req, res) => {
  try {
    console.log('🔍 DEBUG: Exploring family data structure for user:', req.user.userId);
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const gedcomDb = await GedcomDatabase.findOne({ userId: req.user.userId });
    if (!gedcomDb) {
      return res.status(404).json({ message: 'GEDCOM database not found' });
    }

    let encryptedData = gedcomDb.encryptedData;
    if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
      encryptedData = JSON.parse(encryptedData);
    }

    const decryptedData = decryptData(encryptedData, user.encryptionKey);
    const parsedData = JSON.parse(decryptedData);
    
    console.log('📋 Sample family records:');
    if (parsedData.families && parsedData.families.length > 0) {
      // Show first few family records
      const sampleFamilies = parsedData.families.slice(0, 5);
      sampleFamilies.forEach((family, index) => {
        console.log(`Family ${index + 1}:`, JSON.stringify(family, null, 2));
      });
      
      // Look specifically for Stephen's family records
      const stephenId = '@I18834956781@';
      const stephenFamilies = parsedData.families.filter(family => 
        family.husband === stephenId || family.wife === stephenId
      );
      console.log(`🔍 Stephen's families (${stephenFamilies.length}):`, stephenFamilies);
      
      // Broader search - find ANY family that mentions Stephen's ID anywhere
      console.log('🔍 Searching ALL family records for Stephen\'s ID...');
      const familiesWithStephen = parsedData.families.filter(family => {
        const familyStr = JSON.stringify(family);
        return familyStr.includes(stephenId);
      });
      console.log(`📋 Families containing Stephen's ID (${familiesWithStephen.length}):`, familiesWithStephen);
      
      // Also search for "Claudia" in individuals to see if she exists
      const claudiaMatches = parsedData.individuals.filter(person => 
        person.givenNames && person.givenNames.toLowerCase().includes('claudia')
      );
      console.log(`👰 Found ${claudiaMatches.length} individuals named Claudia:`, claudiaMatches.slice(0, 3));
    }

    res.json({
      totalFamilies: parsedData.families ? parsedData.families.length : 0,
      sampleFamilies: parsedData.families ? parsedData.families.slice(0, 3) : [],
      stephenFamilies: parsedData.families ? parsedData.families.filter(family => 
        family.husband === '@I18834956781@' || family.wife === '@I18834956781@'
      ) : []
    });

  } catch (error) {
    console.error('Debug families error:', error);
    res.status(500).json({ message: 'Debug failed', error: error.message });
  }
});

// Get first individual from user's GEDCOM database
router.get('/first-individual', authenticateToken, async (req, res) => {
  try {
    console.log('👤 Fetching first individual for user:', req.user.userId);
    
    const user = await User.findById(req.user.userId);
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('👤 User found:', user.email);
    console.log('🔑 Has encryption key:', !!user.encryptionKey);
    console.log('📁 Has GEDCOM file flag:', user.hasGedcomFile);

    if (!user.hasGedcomFile) {
      console.log('ℹ️ User has no GEDCOM file');
      return res.json({
        success: true,
        firstIndividual: null,
        totalIndividuals: 0,
        totalFamilies: 0,
        message: 'No GEDCOM data available'
      });
    }

    if (!user.encryptionKey) {
      console.log('❌ No encryption key found for user');
      return res.status(500).json({ message: 'No encryption key found for user' });
    }

    // Look for GEDCOM data in the gedcomdatabases collection
    console.log('🗄️ Looking for GEDCOM data for user ID:', user._id);
    
    const gedcomData = await GedcomDatabase.findOne({ userId: user._id });
    if (!gedcomData) {
      console.log('❌ No GEDCOM data found for this user');
      return res.json({
        success: true,
        firstIndividual: null,
        totalIndividuals: 0,
        totalFamilies: 0,
        message: 'No GEDCOM data found for this user'
      });
    }

    console.log('✅ GEDCOM data found:', {
      databaseId: gedcomData.databaseId,
      totalIndividuals: gedcomData.totalIndividuals,
      totalFamilies: gedcomData.totalFamilies,
      hasEncryptedData: !!gedcomData.encryptedData
    });

    if (!gedcomData.encryptedData) {
      console.log('❌ No encrypted GEDCOM content found');
      return res.status(500).json({ 
        message: 'No encrypted GEDCOM data found',
        details: 'GEDCOM record exists but encrypted content is missing'
      });
    }

    console.log('🔓 Attempting to decrypt GEDCOM data...');

    // Decrypt the GEDCOM content
    let decryptedContent;
    try {
      // The encrypted data might be JSON-encoded or direct
      let encryptedData = gedcomData.encryptedData;
      if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
        encryptedData = JSON.parse(encryptedData);
      }
      decryptedContent = decryptData(encryptedData, user.encryptionKey);
    } catch (decryptError) {
      console.log('❌ Decryption failed:', decryptError.message);
      return res.status(500).json({ 
        message: 'Failed to decrypt GEDCOM data',
        details: decryptError.message
      });
    }
    
    if (!decryptedContent) {
      console.log('❌ Decryption returned empty content');
      return res.status(500).json({ message: 'Failed to decrypt GEDCOM data - content is empty' });
    }

    console.log('✅ GEDCOM content decrypted successfully, length:', decryptedContent.length);

    // Parse the GEDCOM content to get individuals
    let parsedData;
    try {
      parsedData = parseGedcomContent(decryptedContent);
    } catch (parseError) {
      console.log('❌ GEDCOM parsing failed:', parseError.message);
      return res.status(500).json({ 
        message: 'Failed to parse GEDCOM data',
        details: parseError.message
      });
    }
    
    const firstIndividual = parsedData.individuals.length > 0 ? parsedData.individuals[0] : null;
    
    console.log('👤 First individual:', firstIndividual ? `${firstIndividual.givenNames} ${firstIndividual.familyNames}` : 'None found');

    res.json({
      success: true,
      firstIndividual: firstIndividual,
      totalIndividuals: parsedData.totalIndividuals || gedcomData.totalIndividuals,
      totalFamilies: parsedData.totalFamilies || gedcomData.totalFamilies
    });

  } catch (error) {
    console.error('❌ Error fetching first individual:', error);
    res.status(500).json({ 
      message: 'Server error while fetching first individual',
      error: error.message
    });
  }
});

module.exports = router;