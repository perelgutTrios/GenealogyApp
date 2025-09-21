/**
 * Test script for the Advanced Name Matching Service
 * Run this to see the enhanced name matching in action
 */

const { NameMatchingService } = require('../services/nameMatchingService');

class NameMatchingDemo {
  constructor() {
    this.nameService = new NameMatchingService();
  }

  runDemonstration() {
    console.log('🎯 Advanced Name Matching Service Demo\n');
    
    // Test 1: Basic nickname matching
    console.log('📝 TEST 1: Nickname Matching');
    this.testNameMatch(
      { givenNames: 'William', familyNames: 'Smith' },
      { givenNames: 'Bill', familyNames: 'Smith' },
      'Should recognize Bill as nickname for William'
    );
    
    // Test 2: Cultural name variations
    console.log('\n📝 TEST 2: Cultural Variations');
    this.testNameMatch(
      { givenNames: 'Stanislaw', familyNames: 'Kowalski' },
      { givenNames: 'Stanley', familyNames: 'Kowalsky' },
      'Polish to Americanized name variation'
    );
    
    // Test 3: Spelling variations
    console.log('\n📝 TEST 3: Spelling Variations');
    this.testNameMatch(
      { givenNames: 'Catherine', familyNames: 'Johnson' },
      { givenNames: 'Kate', familyNames: 'Johnsen' },
      'Nickname + spelling variation'
    );
    
    // Test 4: Maiden name detection
    console.log('\n📝 TEST 4: Maiden Name Detection');
    this.testNameMatch(
      { givenNames: 'Mary', familyNames: 'Smith', maidenName: 'Jones' },
      { givenNames: 'Mary', familyNames: 'Jones' },
      'Should match maiden name to family name'
    );
    
    // Test 5: Phonetic matching (optional)
    console.log('\n📝 TEST 5: Phonetic Matching');
    this.testNameMatchWithOptions(
      { givenNames: 'John', familyNames: 'Smith' },
      { givenNames: 'Jon', familyNames: 'Smyth' },
      { usePhoneticMatching: true },
      'Phonetic similarity with spelling differences'
    );
    
    // Test 6: Complex genealogical scenario
    console.log('\n📝 TEST 6: Complex Genealogical Scenario');
    this.testNameMatch(
      { givenNames: 'Stephen Michael', familyNames: 'Perelgut' },
      { givenNames: 'Steve', familyNames: 'Perelgut' },
      'Multiple given names with nickname'
    );

    console.log('\n✅ Name Matching Demo Complete!\n');
  }

  testNameMatch(person1, person2, description) {
    const result = this.nameService.matchFullNames(person1, person2);
    
    console.log(`   ${description}:`);
    console.log(`   Person 1: ${person1.givenNames} ${person1.familyNames}${person1.maidenName ? ' (née ' + person1.maidenName + ')' : ''}`);
    console.log(`   Person 2: ${person2.givenNames} ${person2.familyNames}`);
    console.log(`   Overall Score: ${Math.round(result.overallScore * 100)}%`);
    console.log(`   Given Name: ${Math.round(result.givenNameScore * 100)}% | Family Name: ${Math.round(result.familyNameScore * 100)}%`);
    if (result.maidenNameScore > 0) {
      console.log(`   Maiden Name: ${Math.round(result.maidenNameScore * 100)}%`);
    }
    console.log(`   Strong Match: ${result.details.strongMatch ? 'YES' : 'NO'}`);
  }

  testNameMatchWithOptions(person1, person2, options, description) {
    const result = this.nameService.matchFullNames(person1, person2, options);
    
    console.log(`   ${description} (with options: ${JSON.stringify(options)}):`);
    console.log(`   Person 1: ${person1.givenNames} ${person1.familyNames}`);
    console.log(`   Person 2: ${person2.givenNames} ${person2.familyNames}`);
    console.log(`   Overall Score: ${Math.round(result.overallScore * 100)}%`);
    console.log(`   Given Name: ${Math.round(result.givenNameScore * 100)}% | Family Name: ${Math.round(result.familyNameScore * 100)}%`);
    console.log(`   Strong Match: ${result.details.strongMatch ? 'YES' : 'NO'}`);
  }

  // Demo for name variations generation
  demoNameVariations() {
    console.log('\n🎨 Name Variations Generation Demo\n');
    
    const testNames = [
      { given: 'William', family: 'Smith' },
      { given: 'Elizabeth', family: 'Johnson' },
      { given: 'Stanislaw', family: 'Kowalski' },
      { given: 'Catherine', family: 'O\'Brien' }
    ];

    testNames.forEach(name => {
      console.log(`📛 ${name.given} ${name.family}:`);
      
      const givenVariations = this.nameService.getNicknameVariations(name.given);
      const familyVariations = this.nameService.getSpellingVariations(name.family);
      const culturalVariations = this.nameService.getCulturalVariations(name.given);
      
      console.log(`   Given Name Variations: ${givenVariations.join(', ')}`);
      console.log(`   Family Name Variations: ${familyVariations.join(', ')}`);
      console.log(`   Cultural Variations: ${culturalVariations.join(', ')}`);
      console.log('');
    });
  }
}

// Run the demo if this script is executed directly
if (require.main === module) {
  const demo = new NameMatchingDemo();
  demo.runDemonstration();
  demo.demoNameVariations();
}

module.exports = { NameMatchingDemo };