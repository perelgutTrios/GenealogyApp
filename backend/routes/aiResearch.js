const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { AIGenealogyService } = require('../services/aiService');
const { ExternalSearchService } = require('../services/externalSearchService');
const { ConfidenceScorer } = require('../services/confidenceScorer');
const { parseGedcomContent } = require('../utils/gedcomParser');
const User = require('../models/User');
const { GedcomDatabase } = require('../models/Gedcom');
const { decryptData } = require('../utils/helpers');

const router = express.Router();

// Initialize AI services
const aiService = new AIGenealogyService();
const externalSearchService = new ExternalSearchService();
const confidenceScorer = new ConfidenceScorer();

/**
 * Generate AI-powered search queries for a person
 * POST /api/ai-research/generate-queries
 */
router.post('/generate-queries', authMiddleware, async (req, res) => {
  try {
    const { personId } = req.body;
    
    if (!personId) {
      return res.status(400).json({ message: 'Person ID is required' });
    }

    console.log(`🤖 Generating AI search queries for person: ${personId}`);

    // Get user's GEDCOM database
    const user = await User.findById(req.user.userId);
    const gedcomDb = await GedcomDatabase.findOne({ userId: user._id });
    
    if (!gedcomDb || !user.encryptionKey) {
      return res.status(404).json({ message: 'GEDCOM data not found' });
    }

    // Decrypt and parse GEDCOM data
    let encryptedData = gedcomDb.encryptedData;
    if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
      encryptedData = JSON.parse(encryptedData);
    }

    const decryptedData = decryptData(encryptedData, user.encryptionKey);
    let parsedData;

    if (decryptedData.trim().startsWith('{')) {
      parsedData = JSON.parse(decryptedData);
    } else {
      parsedData = parseGedcomContent(decryptedData);
    }

    // Find the person
    const person = parsedData.individuals.find(ind => ind.id === personId);
    if (!person) {
      return res.status(404).json({ message: 'Person not found in GEDCOM data' });
    }

    // Get family context for better search queries
    const familyContext = await getPersonFamilyContext(person.id, parsedData.families, parsedData.individuals);
    const enrichedPerson = { ...person, ...familyContext };

    // Generate AI search queries
    const searchQueries = await aiService.generateSearchQueries(enrichedPerson);

    res.json({
      success: true,
      personId: personId,
      personName: `${person.givenNames} ${person.familyNames}`,
      searchQueries: searchQueries,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('❌ Error generating AI search queries:', error);
    res.status(500).json({ 
      message: 'Failed to generate search queries', 
      error: error.message 
    });
  }
});

/**
 * Search external sources for records matching a person
 * POST /api/ai-research/search-external
 */
router.post('/search-external', authMiddleware, async (req, res) => {
  try {
    const { personId, searchQueries } = req.body;
    
    if (!personId || !searchQueries) {
      return res.status(400).json({ message: 'Person ID and search queries are required' });
    }

    console.log(`🔍 Searching external sources for person: ${personId}`);

    // Get person data (similar to generate-queries)
    const user = await User.findById(req.user.userId);
    const gedcomDb = await GedcomDatabase.findOne({ userId: user._id });
    
    if (!gedcomDb || !user.encryptionKey) {
      return res.status(404).json({ message: 'GEDCOM data not found' });
    }

    let encryptedData = gedcomDb.encryptedData;
    if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
      encryptedData = JSON.parse(encryptedData);
    }

    const decryptedData = decryptData(encryptedData, user.encryptionKey);
    let parsedData;

    if (decryptedData.trim().startsWith('{')) {
      parsedData = JSON.parse(decryptedData);
    } else {
      parsedData = parseGedcomContent(decryptedData);
    }

    const person = parsedData.individuals.find(ind => ind.id === personId);
    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    // Get family context
    const familyContext = await getPersonFamilyContext(person.id, parsedData.families, parsedData.individuals);
    const enrichedPerson = { ...person, ...familyContext };

    // Search external sources
    const externalResults = await externalSearchService.searchAllSources(searchQueries, enrichedPerson);

    // Calculate confidence scores for each result
    const scoredResults = await Promise.all(
      externalResults.map(async (result) => {
        const confidenceAnalysis = confidenceScorer.calculateConfidence(
          enrichedPerson, 
          result, 
          { searchQueries }
        );
        
        return {
          ...result,
          confidence: confidenceAnalysis.overallConfidence,
          confidenceAnalysis: confidenceAnalysis,
          aiAnalysis: null // Will be populated on demand
        };
      })
    );

    // Sort by confidence and limit results
    const topResults = scoredResults
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 20); // Limit to top 20 results

    console.log(`✅ External search complete: ${topResults.length} scored results`);

    res.json({
      success: true,
      personId: personId,
      personName: `${person.givenNames} ${person.familyNames}`,
      totalResults: externalResults.length,
      scoredResults: topResults,
      searchedAt: new Date(),
      sources: [...new Set(externalResults.map(r => r.source))] // Unique sources searched
    });

  } catch (error) {
    console.error('❌ Error searching external sources:', error);
    res.status(500).json({ 
      message: 'Failed to search external sources', 
      error: error.message 
    });
  }
});

/**
 * Analyze a specific record match using AI
 * POST /api/ai-research/analyze-match
 */
router.post('/analyze-match', authMiddleware, async (req, res) => {
  try {
    const { personId, recordId, recordData } = req.body;
    
    if (!personId || !recordId || !recordData) {
      return res.status(400).json({ message: 'Person ID, record ID, and record data are required' });
    }

    console.log(`🧠 AI analyzing match between person ${personId} and record ${recordId}`);

    // Get person data (similar pattern as above)
    const user = await User.findById(req.user.userId);
    const gedcomDb = await GedcomDatabase.findOne({ userId: user._id });
    
    if (!gedcomDb || !user.encryptionKey) {
      return res.status(404).json({ message: 'GEDCOM data not found' });
    }

    let encryptedData = gedcomDb.encryptedData;
    if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
      encryptedData = JSON.parse(encryptedData);
    }

    const decryptedData = decryptData(encryptedData, user.encryptionKey);
    let parsedData;

    if (decryptedData.trim().startsWith('{')) {
      parsedData = JSON.parse(decryptedData);
    } else {
      parsedData = parseGedcomContent(decryptedData);
    }

    const person = parsedData.individuals.find(ind => ind.id === personId);
    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    // Get family context
    const familyContext = await getPersonFamilyContext(person.id, parsedData.families, parsedData.individuals);
    const enrichedPerson = { ...person, ...familyContext };

    // Perform AI analysis
    const aiAnalysis = await aiService.analyzeRecordMatch(enrichedPerson, recordData);
    
    // Also get confidence scorer analysis
    const confidenceAnalysis = confidenceScorer.calculateConfidence(enrichedPerson, recordData);

    // Combine both analyses
    const combinedAnalysis = {
      ai: aiAnalysis,
      confidence: confidenceAnalysis,
      finalRecommendation: determineFinalRecommendation(aiAnalysis, confidenceAnalysis),
      analyzedAt: new Date()
    };

    console.log(`✅ AI analysis complete: ${aiAnalysis.confidence || confidenceAnalysis.overallConfidence} confidence`);

    res.json({
      success: true,
      personId: personId,
      recordId: recordId,
      analysis: combinedAnalysis
    });

  } catch (error) {
    console.error('❌ Error in AI match analysis:', error);
    res.status(500).json({ 
      message: 'Failed to analyze record match', 
      error: error.message 
    });
  }
});

/**
 * Get research suggestions for a person
 * GET /api/ai-research/suggestions/:personId
 */
router.get('/suggestions/:personId', authMiddleware, async (req, res) => {
  try {
    const { personId } = req.params;
    
    console.log(`💡 Generating research suggestions for person: ${personId}`);

    // Get person data (similar pattern)
    const user = await User.findById(req.user.userId);
    const gedcomDb = await GedcomDatabase.findOne({ userId: user._id });
    
    if (!gedcomDb || !user.encryptionKey) {
      return res.status(404).json({ message: 'GEDCOM data not found' });
    }

    let encryptedData = gedcomDb.encryptedData;
    if (typeof encryptedData === 'string' && encryptedData.startsWith('{')) {
      encryptedData = JSON.parse(encryptedData);
    }

    const decryptedData = decryptData(encryptedData, user.encryptionKey);
    let parsedData;

    if (decryptedData.trim().startsWith('{')) {
      parsedData = JSON.parse(decryptedData);
    } else {
      parsedData = parseGedcomContent(decryptedData);
    }

    const person = parsedData.individuals.find(ind => ind.id === personId);
    if (!person) {
      return res.status(404).json({ message: 'Person not found' });
    }

    // Generate research suggestions based on missing information
    const suggestions = generateResearchSuggestions(person, parsedData);

    res.json({
      success: true,
      personId: personId,
      personName: `${person.givenNames} ${person.familyNames}`,
      suggestions: suggestions,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('❌ Error generating research suggestions:', error);
    res.status(500).json({ 
      message: 'Failed to generate research suggestions', 
      error: error.message 
    });
  }
});

/**
 * Helper function to get family context for a person
 */
async function getPersonFamilyContext(personId, families, individuals) {
  const familyData = {
    parents: { father: null, mother: null },
    spouses: [],
    children: []
  };

  // Find families where this person is a spouse
  const spouseFamilies = families.filter(family => 
    family.husband === personId || family.wife === personId
  );

  // Find spouses
  for (const family of spouseFamilies) {
    const spouseId = family.husband === personId ? family.wife : family.husband;
    if (spouseId) {
      const spouse = individuals.find(ind => ind.id === spouseId);
      if (spouse) {
        familyData.spouses.push({
          id: spouse.id,
          givenNames: spouse.givenNames || 'Unknown',
          familyNames: spouse.familyNames || 'Unknown'
        });
      }
    }
  }

  // Find families where this person is a child
  const childFamilies = families.filter(family => 
    family.children && family.children.includes(personId)
  );

  // Find parents
  if (childFamilies.length > 0) {
    const parentFamily = childFamilies[0];
    
    if (parentFamily.husband) {
      const father = individuals.find(ind => ind.id === parentFamily.husband);
      if (father) {
        familyData.parents.father = {
          id: father.id,
          givenNames: father.givenNames || 'Unknown',
          familyNames: father.familyNames || 'Unknown'
        };
      }
    }
    
    if (parentFamily.wife) {
      const mother = individuals.find(ind => ind.id === parentFamily.wife);
      if (mother) {
        familyData.parents.mother = {
          id: mother.id,
          givenNames: mother.givenNames || 'Unknown',
          familyNames: mother.familyNames || 'Unknown'
        };
      }
    }
  }

  return familyData;
}

/**
 * Helper function to determine final recommendation combining AI and confidence analysis
 */
function determineFinalRecommendation(aiAnalysis, confidenceAnalysis) {
  // Weight AI analysis slightly higher since it considers more context
  const aiWeight = 0.6;
  const confidenceWeight = 0.4;
  
  const aiScore = aiAnalysis.confidence || 0.5;
  const confidenceScore = confidenceAnalysis.overallConfidence;
  
  const finalScore = (aiScore * aiWeight) + (confidenceScore * confidenceWeight);
  
  let recommendation;
  if (finalScore >= 0.85) {
    recommendation = 'accept';
  } else if (finalScore >= 0.60) {
    recommendation = 'review';
  } else {
    recommendation = 'reject';
  }
  
  return {
    score: finalScore,
    action: recommendation,
    reasoning: `Combined AI analysis (${Math.round(aiScore * 100)}%) and confidence scoring (${Math.round(confidenceScore * 100)}%)`
  };
}

/**
 * Helper function to generate research suggestions
 */
function generateResearchSuggestions(person, gedcomData) {
  const suggestions = [];
  
  // Missing vital information
  if (!person.birthDate) {
    suggestions.push({
      type: 'vital_record',
      priority: 'high',
      title: 'Find Birth Record',
      description: 'Search for birth certificate or baptismal record',
      searchTargets: ['Vital Records', 'Church Records', 'Census Records']
    });
  }
  
  if (!person.deathDate && isLikelyDeceased(person)) {
    suggestions.push({
      type: 'vital_record',
      priority: 'high',
      title: 'Find Death Record',
      description: 'Search for death certificate or obituary',
      searchTargets: ['Death Records', 'Obituaries', 'Cemetery Records']
    });
  }
  
  if (!person.birthPlace) {
    suggestions.push({
      type: 'location',
      priority: 'medium',
      title: 'Determine Birth Location',
      description: 'Use census records and family documents to find birth location',
      searchTargets: ['Census Records', 'Immigration Records', 'Marriage Records']
    });
  }
  
  // Missing family connections
  const familyContext = getPersonFamilyContext(person.id, gedcomData.families, gedcomData.individuals);
  
  if (!familyContext.parents.father) {
    suggestions.push({
      type: 'family',
      priority: 'medium',
      title: 'Find Father\'s Identity',
      description: 'Search for marriage records, census records, or family documents',
      searchTargets: ['Marriage Records', 'Census Records', 'Family Trees']
    });
  }
  
  if (!familyContext.parents.mother) {
    suggestions.push({
      type: 'family',
      priority: 'medium',
      title: 'Find Mother\'s Identity',
      description: 'Search for marriage records, census records, or birth records',
      searchTargets: ['Marriage Records', 'Census Records', 'Birth Records']
    });
  }
  
  if (familyContext.spouses.length === 0 && !isLikelyNeverMarried(person)) {
    suggestions.push({
      type: 'family',
      priority: 'medium',
      title: 'Find Marriage Information',
      description: 'Search for marriage records or spouse information',
      searchTargets: ['Marriage Records', 'Census Records', 'Obituaries']
    });
  }
  
  // Research opportunities
  suggestions.push({
    type: 'research',
    priority: 'low',
    title: 'Newspaper Research',
    description: 'Search newspaper archives for mentions, obituaries, or announcements',
    searchTargets: ['Newspaper Archives', 'Local Historical Societies']
  });
  
  suggestions.push({
    type: 'research',
    priority: 'low',
    title: 'Military Records',
    description: 'Check for military service records if person lived during wartime',
    searchTargets: ['Military Records', 'Pension Records', 'Draft Registration']
  });
  
  return suggestions.sort((a, b) => {
    const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

/**
 * Helper functions for research suggestions
 */
function isLikelyDeceased(person) {
  if (!person.birthDate) return false;
  
  const birthYear = extractYear(person.birthDate);
  if (!birthYear) return false;
  
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  
  return age > 125; // Same logic as the "presumed dead" feature
}

function isLikelyNeverMarried(person) {
  // Simple heuristic - could be enhanced with more sophisticated logic
  if (!person.birthDate) return false;
  
  const birthYear = extractYear(person.birthDate);
  if (!birthYear) return false;
  
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  
  // If person died very young, might not have married
  return age < 16 || (person.deathDate && extractYear(person.deathDate) - birthYear < 16);
}

function extractYear(dateString) {
  if (!dateString) return null;
  const yearMatch = dateString.match(/\b(18|19|20)\d{2}\b/);
  return yearMatch ? parseInt(yearMatch[0]) : null;
}

module.exports = router;