const { GenealogyValidationService } = require('../services/genealogyValidationService');

// Initialize validation service
const validationService = new GenealogyValidationService();

async function runValidationDemo() {
  console.log('\n🧬 GENEALOGY VALIDATION SERVICE DEMONSTRATION');
  console.log('=' .repeat(60));
  
  // TEST 1: Valid family record
  console.log('\n📋 TEST 1: Valid Family Record');
  console.log('-'.repeat(30));
  const validFamily = {
    person: {
      name: 'John Smith',
      birthDate: '1920-03-15',
      deathDate: '1985-07-22',
      birthPlace: 'New York, NY',
      parents: ['father123', 'mother456'],
      spouse: 'spouse789'
    },
    father: {
      name: 'Robert Smith',
      birthDate: '1895-01-10',
      deathDate: '1970-12-05'
    },
    mother: {
      name: 'Mary Johnson',
      birthDate: '1898-06-20',
      deathDate: '1975-03-18'
    },
    spouse: {
      name: 'Elizabeth Brown',
      birthDate: '1922-11-08',
      marriageDate: '1942-05-15'
    }
  };
  
  const validation1 = validationService.validatePersonRecord(validFamily.person, {
    father: validFamily.father,
    mother: validFamily.mother,
    spouse: validFamily.spouse
  });
  
  console.log(`✅ Validation Score: ${Math.round(validation1.validationScore * 100)}%`);
  console.log(`📊 Data Quality: ${Math.round(validation1.qualityAssessment.score * 100)}%`);
  console.log(`⚠️  Issues: ${validation1.issues.length}, Warnings: ${validation1.warnings.length}`);
  if (validation1.issues.length > 0) {
    validation1.issues.forEach(issue => {
      console.log(`   🚨 ${issue.message} (${issue.severity})`);
    });
  }
  
  // TEST 2: Invalid ages (impossible parent-child relationships)
  console.log('\n📋 TEST 2: Invalid Parent-Child Ages');
  console.log('-'.repeat(30));
  const invalidAges = {
    person: {
      name: 'Jane Doe',
      birthDate: '1950-06-15',
      parents: ['father', 'mother']  // Updated to match family context keys
    },
    youngfather: {
      name: 'Young Father',
      birthDate: '1955-01-01' // Born AFTER his child!
    },
    youngmother: {
      name: 'Young Mother', 
      birthDate: '1952-03-10' // Only 2 years older than child
    }
  };
  
  const validation2 = validationService.validatePersonRecord(invalidAges.person, {
    father: invalidAges.youngfather,  // Need to use 'father' key, not 'youngfather'
    mother: invalidAges.youngmother   // Need to use 'mother' key, not 'youngmother'
  });
  
  console.log(`❌ Validation Score: ${Math.round(validation2.validationScore * 100)}%`);
  console.log(`📊 Data Quality: ${Math.round(validation2.qualityAssessment.score * 100)}%`);
  console.log(`🚨 Critical Issues Found:`);
  validation2.issues.forEach(issue => {
    console.log(`   - ${issue.message} (${issue.severity})`);
  });
  
  // TEST 3: Historical inconsistencies
  console.log('\n📋 TEST 3: Historical Inconsistencies');
  console.log('-'.repeat(30));
  const historicalIssues = {
    person: {
      name: 'Time Traveler',
      birthDate: '1800-01-01',
      birthPlace: 'California, USA', // California wasn't a US state yet!
      deathDate: '1900-12-31',
      occupation: 'Computer Programmer' // Anachronistic profession
    }
  };
  
  const validation3 = validationService.validatePersonRecord(historicalIssues.person);
  
  console.log(`⚠️  Validation Score: ${Math.round(validation3.validationScore * 100)}%`);
  console.log(`📊 Data Quality: ${Math.round(validation3.qualityAssessment.score * 100)}%`);
  console.log(`🔍 Historical Issues Found:`);
  validation3.warnings.forEach(warning => {
    console.log(`   - ${warning.message}`);
  });
  
  // TEST 4: Relationship validation
  console.log('\n📋 TEST 4: Relationship Validation');
  console.log('-'.repeat(30));
  
  const relationshipTest = {
    person: {
      name: 'Child Smith',
      birthDate: '1950-08-15',
      parents: ['father456', 'mother789'],
      spouse: 'spouse123'
    },
    father: {
      name: 'Father Smith',
      birthDate: '1920-03-10',
      deathDate: '1948-01-01' // Died before child was born!
    },
    mother: {
      name: 'Mother Smith',
      birthDate: '1925-07-20'
    },
    spouse: {
      name: 'Spouse Jones',
      birthDate: '1948-12-05',
      marriageDate: '1968-06-10' // Married at age 19-20, reasonable
    }
  };
  
  const validation4 = validationService.validatePersonRecord(relationshipTest.person, {
    father: relationshipTest.father,
    mother: relationshipTest.mother,
    spouse: relationshipTest.spouse
  });
  
  console.log(`🔍 DEBUG: Father died ${relationshipTest.father.deathDate}, child born ${relationshipTest.person.birthDate}`);
  
  console.log(`🔍 Validation Score: ${Math.round(validation4.validationScore * 100)}%`);
  console.log(`📊 Data Quality: ${Math.round(validation4.qualityAssessment.score * 100)}%`);
  console.log(`⚠️  Issues: ${validation4.issues.length}, Warnings: ${validation4.warnings.length}`);
  
  if (validation4.issues.length > 0) {
    console.log(`🚨 Critical Issues:`);
    validation4.issues.forEach(issue => {
      console.log(`   - ${issue.message} (${issue.severity})`);
    });
  }
  
  if (validation4.warnings.length > 0) {
    console.log(`⚠️  Warnings:`);
    validation4.warnings.forEach(warning => {
      console.log(`   - ${warning.message}`);
    });
  }
  
  // TEST 5: Data quality assessment
  console.log('\n📋 TEST 5: Data Quality Assessment');
  console.log('-'.repeat(30));
  
  const poorQuality = {
    name: '', // Missing name
    birthDate: '1900', // Incomplete date
    birthPlace: 'Unknown', // Vague location
    occupation: '' // Missing data
  };
  
  const validation5 = validationService.validatePersonRecord(poorQuality);
  
  console.log(`📊 Poor Quality Data Score: ${Math.round(validation5.qualityAssessment.score * 100)}%`);
  console.log(`📈 Quality Breakdown:`);
  console.log(`   - Completeness: ${Math.round(validation5.qualityAssessment.completeness * 100)}%`);
  console.log(`   - Quality Factors: ${validation5.qualityAssessment.factors.join(', ')}`);
  console.log(`   - Recommendation: ${validation5.qualityAssessment.recommendation}`);
  
  console.log('\n✅ VALIDATION SERVICE DEMONSTRATION COMPLETE');
  console.log('=' .repeat(60));
  console.log('🚀 The validation service provides:');
  console.log('   • Parent-child age relationship validation');
  console.log('   • Spouse age gap and marriage timing checks');
  console.log('   • Death-before-birth impossibility detection');
  console.log('   • Historical context awareness (locations, occupations)');
  console.log('   • Comprehensive data quality scoring');
  console.log('   • Timeline consistency validation');
  console.log('   • Missing data detection and scoring');
  console.log('   • Detailed issue reporting with severity levels');
  
  console.log('\n🔗 Ready for integration with AI service for enhanced analysis!');
}

// Run the demonstration
if (require.main === module) {
  runValidationDemo().catch(console.error);
}

module.exports = { runValidationDemo };