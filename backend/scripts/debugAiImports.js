/**
 * Test script to debug AI service import issues
 * Run with: node scripts/debugAiImports.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testImports() {
  console.log('🧪 Testing AI service imports...\n');

  try {
    // Test OpenAI API key
    console.log('🔑 OpenAI API Key:', process.env.OPENAI_API_KEY ? 'Set (starts with ' + process.env.OPENAI_API_KEY.substring(0, 10) + '...)' : 'NOT SET');

    // Test AI service import
    console.log('\n📦 Testing AI service import...');
    const { AIGenealogyService } = require('../services/aiService');
    console.log('✅ AIGenealogyService imported successfully');
    
    const aiService = new AIGenealogyService();
    console.log('✅ AIGenealogyService instantiated successfully');

    // Test External search service import
    console.log('\n📦 Testing External search service import...');
    const { ExternalSearchService } = require('../services/externalSearchService');
    console.log('✅ ExternalSearchService imported successfully');
    
    const externalService = new ExternalSearchService();
    console.log('✅ ExternalSearchService instantiated successfully');

    // Test Confidence scorer import
    console.log('\n📦 Testing Confidence scorer import...');
    const { ConfidenceScorer } = require('../services/confidenceScorer');
    console.log('✅ ConfidenceScorer imported successfully');
    
    const confidenceScorer = new ConfidenceScorer();
    console.log('✅ ConfidenceScorer instantiated successfully');

    // Test a simple AI call
    console.log('\n🤖 Testing AI service with mock data...');
    const mockPerson = {
      id: 'test-123',
      givenNames: 'John',
      familyNames: 'Smith',
      birthDate: '1900',
      birthPlace: 'New York',
      sex: 'M'
    };

    try {
      const result = await aiService.generateSearchQueries(mockPerson);
      console.log('✅ AI service call successful');
      console.log('📊 Generated queries:', JSON.stringify(result, null, 2));
    } catch (aiError) {
      console.log('❌ AI service call failed:', aiError.message);
      console.log('🔍 Full error:', aiError);
    }

  } catch (error) {
    console.error('❌ Import error:', error.message);
    console.error('🔍 Full error:', error);
  }
}

testImports().catch(console.error);