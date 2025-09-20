/**
 * API Configuration Tester
 * 
 * This script helps you test your API configurations without running the full application.
 * Run with: node scripts/testApiConfig.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logResult(success, message) {
  const symbol = success ? '✅' : '❌';
  const color = success ? colors.green : colors.red;
  log(color, `${symbol} ${message}`);
}

async function testOpenAI() {
  log(colors.blue, '\n🧠 Testing OpenAI API...');
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    logResult(false, 'OpenAI API key not configured');
    log(colors.yellow, '   ⚠️  Please set OPENAI_API_KEY in your .env file');
    return false;
  }
  
  if (!apiKey.startsWith('sk-')) {
    logResult(false, 'OpenAI API key format appears incorrect');
    log(colors.yellow, '   ⚠️  Key should start with "sk-"');
    return false;
  }
  
  try {
    // Test with a simple API call
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      logResult(true, 'OpenAI API connection successful');
      const data = await response.json();
      log(colors.green, `   📊 Available models: ${data.data.length}`);
      return true;
    } else {
      logResult(false, `OpenAI API error: ${response.status} ${response.statusText}`);
      return false;
    }
  } catch (error) {
    logResult(false, `OpenAI API connection failed: ${error.message}`);
    return false;
  }
}

async function testFamilySearch() {
  log(colors.blue, '\n📚 Testing FamilySearch API...');
  
  const clientId = process.env.FAMILYSEARCH_CLIENT_ID;
  const clientSecret = process.env.FAMILYSEARCH_CLIENT_SECRET;
  
  if (!clientId || clientId === 'your_familysearch_client_id_here' || 
      !clientSecret || clientSecret === 'your_familysearch_client_secret_here') {
    logResult(false, 'FamilySearch API credentials not configured');
    log(colors.yellow, '   ⚠️  Please set FAMILYSEARCH_CLIENT_ID and FAMILYSEARCH_CLIENT_SECRET');
    return false;
  }
  
  try {
    // Test authentication
    const authResponse = await fetch('https://api.familysearch.org/platform/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    
    if (authResponse.ok) {
      logResult(true, 'FamilySearch API authentication successful');
      const authData = await authResponse.json();
      log(colors.green, `   🔑 Access token obtained (expires in ${authData.expires_in}s)`);
      return true;
    } else {
      logResult(false, `FamilySearch API auth failed: ${authResponse.status}`);
      const errorData = await authResponse.text();
      log(colors.red, `   💥 Error: ${errorData}`);
      return false;
    }
  } catch (error) {
    logResult(false, `FamilySearch API connection failed: ${error.message}`);
    return false;
  }
}

function testEnvironmentVariables() {
  log(colors.blue, '\n🔧 Checking Environment Variables...');
  
  const requiredVars = [
    'NODE_ENV',
    'PORT',
    'MONGODB_URI',
    'JWT_SECRET'
  ];
  
  const optionalVars = [
    'OPENAI_API_KEY',
    'FAMILYSEARCH_CLIENT_ID',
    'FAMILYSEARCH_CLIENT_SECRET',
    'WIKITREE_API_KEY',
    'CHRONICLING_AMERICA_API_BASE'
  ];
  
  let allRequired = true;
  
  log(colors.bold, '\n   Required Variables:');
  requiredVars.forEach(varName => {
    const value = process.env[varName];
    const isSet = value && value.length > 0;
    logResult(isSet, `${varName}: ${isSet ? '✓ Set' : '✗ Missing'}`);
    if (!isSet) allRequired = false;
  });
  
  log(colors.bold, '\n   AI Enhancement Variables:');
  optionalVars.forEach(varName => {
    const value = process.env[varName];
    const isConfigured = value && 
      !value.includes('your_') && 
      !value.includes('_here') && 
      value !== 'not_publicly_available';
    
    const status = isConfigured ? '✓ Configured' : 
      value ? '⚠ Placeholder' : '✗ Not Set';
    
    logResult(isConfigured, `${varName}: ${status}`);
  });
  
  return allRequired;
}

function testDatabaseConnection() {
  log(colors.blue, '\n🗄️  Testing Database Configuration...');
  
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    logResult(false, 'MONGODB_URI not configured');
    return false;
  }
  
  // Basic URI format validation
  if (mongoUri.startsWith('mongodb://') || mongoUri.startsWith('mongodb+srv://')) {
    logResult(true, 'MongoDB URI format appears correct');
    log(colors.green, `   🔗 URI: ${mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
    return true;
  } else {
    logResult(false, 'MongoDB URI format appears incorrect');
    return false;
  }
}

function displaySummary(results) {
  log(colors.blue, '\n📋 Configuration Summary:');
  log(colors.bold, '================================');
  
  const total = Object.keys(results).length;
  const passed = Object.values(results).filter(Boolean).length;
  
  Object.entries(results).forEach(([test, passed]) => {
    logResult(passed, test);
  });
  
  log(colors.bold, `\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    log(colors.green, '🎉 All configurations are ready!');
    log(colors.green, '✨ You can start using AI features immediately');
  } else if (results['OpenAI API'] && results['Environment Variables']) {
    log(colors.yellow, '⚡ Basic configuration ready');
    log(colors.yellow, '🔧 Configure remaining APIs for full functionality');
  } else {
    log(colors.red, '🚨 Critical configurations missing');
    log(colors.red, '📖 Please check the API_CONFIGURATION_GUIDE.md');
  }
}

async function runTests() {
  log(colors.bold, '🚀 API Configuration Tester');
  log(colors.bold, '============================');
  
  const results = {};
  
  // Test all configurations
  results['Environment Variables'] = testEnvironmentVariables();
  results['Database Connection'] = testDatabaseConnection();
  results['OpenAI API'] = await testOpenAI();
  results['FamilySearch API'] = await testFamilySearch();
  
  // Display summary
  displaySummary(results);
  
  log(colors.blue, '\n📚 For detailed setup instructions, see:');
  log(colors.blue, '   📄 API_CONFIGURATION_GUIDE.md');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(error => {
    log(colors.red, `\n💥 Test runner error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runTests };