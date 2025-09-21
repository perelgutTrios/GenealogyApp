const { GenealogyValidationService } = require('../services/genealogyValidationService');
const { AIGenealogyService } = require('../services/aiService');

// Initialize services
const validationService = new GenealogyValidationService();
const aiService = new AIGenealogyService();

async function runValidationDemo() {
  console.log('\n🧬 GENEALOGY VALIDATION SYSTEM DEMONSTRATION');
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
  
  // TEST 2: Invalid ages (impossible parent-child relationships)
  console.log('\n📋 TEST 2: Invalid Parent-Child Ages');
  console.log('-'.repeat(30));
  const invalidAges = {
    person: {
      name: 'Jane Doe',
      birthDate: '1950-06-15',
      parents: ['youngfather', 'youngmother']
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
    youngfather: invalidAges.youngfather,
    youngmother: invalidAges.youngmother
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
  
  // TEST 4: Integration with AI Service (Enhanced Analysis)
  console.log('\n📋 TEST 4: AI Service Integration');
  console.log('-'.repeat(30));
  
  const person = {
    name: 'William Johnson',
    birthDate: '1925-05-20',
    birthPlace: 'Boston, MA'
  };
  
  const match = {
    name: 'Bill Johnson', // Nickname match
    birth_date: '1925-05-20',
    birth_place: 'Boston, Massachusetts',
    parents: ['oldfather', 'normalmother']
  };
  
  const relatedData = {
    oldfather: {
      name: 'Ancient Father',
      birthDate: '1850-01-01' // 75 years old when child born - unusual but possible
    },
    normalmother: {
      name: 'Normal Mother',
      birthDate: '1900-03-15'
    }
  };
  
  console.log('🤖 Running enhanced AI analysis...');
  const analysis = await aiService.fallbackMatchAnalysis(person, match, relatedData);
  
  console.log(`🎯 AI Confidence: ${Math.round(analysis.confidence * 100)}%`);
  console.log(`💡 Recommendation: ${analysis.recommendation.toUpperCase()}`);
  console.log(`🧠 Reasoning: ${analysis.reasoning}`);
  console.log(`📈 Matching Factors: ${analysis.matchingFactors.join(', ')}`);
  
  if (analysis.validation) {
    console.log(`\n🔍 Validation Details:`);
    console.log(`   Person Validation: ${Math.round(analysis.validation.personValidation.score * 100)}% score`);
    console.log(`   Match Validation: ${Math.round(analysis.validation.matchValidation.score * 100)}% score`);
    console.log(`   Combined Issues: ${analysis.validation.personValidation.issues + analysis.validation.matchValidation.issues}`);
  }
  
  if (analysis.concerns.length > 0) {
    console.log(`⚠️  Concerns: ${analysis.concerns.join(', ')}`);
  }
  
  // TEST 5: Mock Data Detection
  console.log('\n📋 TEST 5: Mock Data Detection');
  console.log('-'.repeat(30));
  
  const mockPerson = {
    name: 'John Doe',
    birthDate: '1900-01-01'
  };
  
  const mockMatch = {
    name: 'Test Person',
    birth_date: '1900-01-01'
  };
  
  console.log('🎭 Testing mock data detection...');
  const mockAnalysis = await aiService.fallbackMatchAnalysis(mockPerson, mockMatch);
  
  console.log(`🎯 Mock Data Confidence: ${Math.round(mockAnalysis.confidence * 100)}%`);
  console.log(`💡 Recommendation: ${mockAnalysis.recommendation.toUpperCase()}`);
  console.log(`🧠 Reasoning: ${mockAnalysis.reasoning}`);
  
  console.log('\n✅ VALIDATION SYSTEM DEMONSTRATION COMPLETE');
  console.log('=' .repeat(60));
  console.log('🚀 The system now provides:');
  console.log('   • Comprehensive relationship validation');
  console.log('   • Timeline consistency checking');
  console.log('   • Historical context awareness');
  console.log('   • Data quality assessment');
  console.log('   • Enhanced AI confidence scoring');
  console.log('   • Mock data detection');
  console.log('   • Detailed validation reporting');
}

// Run the demonstration
if (require.main === module) {
  runValidationDemo().catch(console.error);
}

module.exports = { runValidationDemo };