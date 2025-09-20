const OpenAI = require('openai');
const axios = require('axios');

class AIGenealogyService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.familySearchToken = process.env.FAMILYSEARCH_API_KEY;
    this.ancestryApiKey = process.env.ANCESTRY_API_KEY;
  }

  /**
   * Generate intelligent search variations for a person
   * Uses GPT-4 to create genealogically-aware search strategies
   */
  async generateSearchQueries(person) {
    console.log('🤖 Generating AI search queries for:', person.givenNames, person.familyNames);

    const prompt = `
You are a professional genealogist. Generate comprehensive search strategies for finding records about this person:

Person Details:
- Name: ${person.givenNames} ${person.familyNames}
- Birth Date: ${person.birthDate || 'Unknown'}
- Birth Place: ${person.birthPlace || 'Unknown'}
- Sex: ${person.sex || 'Unknown'}
- Parents: ${person.parents ? `${person.parents.father?.givenNames || ''} ${person.parents.father?.familyNames || ''}, ${person.parents.mother?.givenNames || ''} ${person.parents.mother?.familyNames || ''}` : 'Unknown'}
- Spouse: ${person.spouses?.[0] ? `${person.spouses[0].givenNames} ${person.spouses[0].familyNames}` : 'Unknown'}

Generate a JSON response with these search strategies:
1. "nameVariations": Array of 8-10 name spelling variations, nicknames, cultural variants
2. "locationVariations": Array of 5-7 location name variants (historical names, abbreviations, nearby places)
3. "timeRangeQueries": Array of 3-4 expanded date ranges for birth/death searches
4. "contextualSearches": Array of 5-6 searches combining family members, occupations, or life events
5. "recordTypeTargets": Array of 8-10 specific record types to search (census, vital records, immigration, etc.)

Focus on genealogically sound variations. Consider:
- Historical spelling changes
- Immigration name alterations  
- Regional pronunciation differences
- Nickname patterns by era/culture
- Place name evolution over time
- Record availability by time period

Return only valid JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ 
          role: "system", 
          content: "You are an expert genealogist specializing in record research and name variations. Always respond with valid JSON only." 
        }, { 
          role: "user", 
          content: prompt 
        }],
        temperature: 0.7,
        max_tokens: 1500
      });

      const searchStrategies = JSON.parse(response.choices[0].message.content);
      console.log('✅ Generated', Object.keys(searchStrategies).length, 'search strategy categories');
      
      return {
        ...searchStrategies,
        generatedAt: new Date(),
        personId: person.id,
        confidence: 0.85
      };

    } catch (error) {
      console.error('❌ AI query generation failed:', error.message);
      // Fallback to rule-based generation
      return this.generateFallbackQueries(person);
    }
  }

  /**
   * Fallback search generation using rules-based approach
   */
  generateFallbackQueries(person) {
    console.log('🔄 Using fallback query generation');
    
    const nameVariations = this.generateNameVariations(person.givenNames, person.familyNames);
    const locationVariations = this.generateLocationVariations(person.birthPlace);
    
    return {
      nameVariations,
      locationVariations,
      timeRangeQueries: this.generateTimeRanges(person.birthDate),
      contextualSearches: this.generateContextualSearches(person),
      recordTypeTargets: [
        'census records', 'birth certificates', 'death certificates', 
        'marriage records', 'immigration records', 'military records',
        'city directories', 'newspaper obituaries'
      ],
      generatedAt: new Date(),
      personId: person.id,
      confidence: 0.65,
      method: 'fallback'
    };
  }

  /**
   * Generate name variations using linguistic rules
   */
  generateNameVariations(givenNames, familyNames) {
    const variations = new Set();
    
    // Original name
    variations.add(`${givenNames} ${familyNames}`);
    
    // Common nickname patterns
    if (givenNames) {
      const nicknames = this.getNicknames(givenNames);
      nicknames.forEach(nick => variations.add(`${nick} ${familyNames}`));
    }
    
    // Initial patterns
    if (givenNames) {
      const firstInitial = givenNames.charAt(0);
      variations.add(`${firstInitial} ${familyNames}`);
      variations.add(`${firstInitial}. ${familyNames}`);
    }
    
    // Common spelling variations
    if (familyNames) {
      const spellVariations = this.getSpellingVariations(familyNames);
      spellVariations.forEach(variant => variations.add(`${givenNames} ${variant}`));
    }
    
    return Array.from(variations);
  }

  /**
   * Common nickname mappings
   */
  getNicknames(givenName) {
    const nicknameMap = {
      'Stephen': ['Steve', 'Steven', 'Stephan'],
      'William': ['Bill', 'Will', 'Billy', 'Willie'],
      'Robert': ['Bob', 'Rob', 'Bobby', 'Robbie'],
      'James': ['Jim', 'Jimmy', 'Jamie'],
      'Michael': ['Mike', 'Mickey', 'Mick'],
      'Elizabeth': ['Betty', 'Beth', 'Liz', 'Lizzie', 'Eliza'],
      'Margaret': ['Maggie', 'Meg', 'Peggy', 'Margie'],
      'Catherine': ['Kate', 'Katie', 'Cathy', 'Kitty'],
      // Add more mappings as needed
    };
    
    return nicknameMap[givenName] || [givenName];
  }

  /**
   * Generate spelling variations for surnames
   */
  getSpellingVariations(surname) {
    const variations = new Set([surname]);
    
    // Common letter substitutions
    const substitutions = [
      ['ph', 'f'], ['f', 'ph'], ['c', 'k'], ['k', 'c'],
      ['ie', 'y'], ['y', 'ie'], ['sen', 'son'], ['son', 'sen'],
      ['tz', 'ts'], ['ts', 'tz'], ['w', 'v'], ['v', 'w']
    ];
    
    substitutions.forEach(([from, to]) => {
      if (surname.includes(from)) {
        variations.add(surname.replace(from, to));
      }
    });
    
    return Array.from(variations);
  }

  /**
   * Generate location variations
   */
  generateLocationVariations(location) {
    if (!location) return [];
    
    const variations = new Set([location]);
    
    // Remove state/country for broader search
    const parts = location.split(',').map(p => p.trim());
    if (parts.length > 1) {
      variations.add(parts[0]); // City only
      variations.add(parts.slice(0, 2).join(', ')); // City, State
    }
    
    // Common abbreviations
    const abbreviations = {
      'Ontario': 'ON',
      'Canada': 'CAN',
      'United States': 'USA',
      'Pennsylvania': 'PA',
      'New York': 'NY'
      // Add more as needed
    };
    
    Object.entries(abbreviations).forEach(([full, abbr]) => {
      if (location.includes(full)) {
        variations.add(location.replace(full, abbr));
      }
      if (location.includes(abbr)) {
        variations.add(location.replace(abbr, full));
      }
    });
    
    return Array.from(variations);
  }

  /**
   * Generate time range queries
   */
  generateTimeRanges(birthDate) {
    if (!birthDate) return [];
    
    const year = this.extractYear(birthDate);
    if (!year) return [];
    
    return [
      `${year-2}-${year+2}`, // ±2 years
      `${year-5}-${year+5}`, // ±5 years  
      `${year-10}-${year+10}`, // ±10 years
      `${Math.floor(year/10)*10}-${Math.floor(year/10)*10 + 9}` // Same decade
    ];
  }

  /**
   * Extract year from various date formats
   */
  extractYear(dateString) {
    if (!dateString) return null;
    
    const yearMatch = dateString.match(/\b(18|19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  /**
   * Generate contextual searches using family relationships
   */
  generateContextualSearches(person) {
    const searches = [];
    
    // Family group searches
    if (person.parents?.father) {
      searches.push(`${person.givenNames} ${person.familyNames} son of ${person.parents.father.givenNames} ${person.parents.father.familyNames}`);
    }
    
    if (person.parents?.mother) {
      searches.push(`${person.givenNames} ${person.familyNames} son of ${person.parents.mother.givenNames} ${person.parents.mother.familyNames}`);
    }
    
    if (person.spouses?.[0]) {
      searches.push(`${person.givenNames} ${person.familyNames} married ${person.spouses[0].givenNames} ${person.spouses[0].familyNames}`);
    }
    
    // Location-based searches
    if (person.birthPlace) {
      searches.push(`${person.givenNames} ${person.familyNames} born ${person.birthPlace}`);
    }
    
    return searches;
  }

  /**
   * Analyze potential record match using AI
   */
  async analyzeRecordMatch(person, potentialMatch) {
    console.log('🧠 AI analyzing record match...');

    const prompt = `
As a professional genealogist, analyze if these two records likely represent the same person:

PERSON 1 (Known):
- Name: ${person.givenNames} ${person.familyNames}
- Birth: ${person.birthDate} in ${person.birthPlace}
- Parents: ${person.parents?.father?.givenNames || ''} ${person.parents?.father?.familyNames || ''} & ${person.parents?.mother?.givenNames || ''} ${person.parents?.mother?.familyNames || ''}
- Spouse: ${person.spouses?.[0]?.givenNames || ''} ${person.spouses?.[0]?.familyNames || ''}

POTENTIAL MATCH:
- Name: ${potentialMatch.name}
- Birth: ${potentialMatch.birth}
- Location: ${potentialMatch.location}
- Additional Info: ${potentialMatch.additionalInfo || 'None'}

Provide analysis as JSON:
{
  "confidence": 0.85,
  "reasoning": "Detailed explanation of match factors",
  "matchingFactors": ["name similarity", "birth date match", "location match"],
  "concerns": ["any conflicting information"],
  "recommendation": "accept|review|reject"
}

Consider:
- Name variations and cultural spellings
- Historical location changes
- Date recording variations
- Family context clues
- Record reliability by source type`;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ 
          role: "system", 
          content: "You are an expert genealogist. Analyze record matches carefully and respond with valid JSON only." 
        }, { 
          role: "user", 
          content: prompt 
        }],
        temperature: 0.3, // Lower temperature for more consistent analysis
        max_tokens: 800
      });

      const analysis = JSON.parse(response.choices[0].message.content);
      console.log('✅ AI match analysis complete:', analysis.confidence);
      
      return {
        ...analysis,
        analyzedAt: new Date(),
        method: 'ai'
      };

    } catch (error) {
      console.error('❌ AI match analysis failed:', error.message);
      return this.fallbackMatchAnalysis(person, potentialMatch);
    }
  }

  /**
   * Fallback rule-based match analysis
   */
  fallbackMatchAnalysis(person, potentialMatch) {
    console.log('🔄 Using fallback match analysis');
    
    let confidence = 0;
    const matchingFactors = [];
    const concerns = [];
    
    // Name similarity (basic)
    const nameScore = this.calculateNameSimilarity(
      `${person.givenNames} ${person.familyNames}`,
      potentialMatch.name
    );
    confidence += nameScore * 0.4;
    if (nameScore > 0.7) matchingFactors.push('name similarity');
    
    // Birth date proximity  
    if (person.birthDate && potentialMatch.birth) {
      const dateScore = this.calculateDateSimilarity(person.birthDate, potentialMatch.birth);
      confidence += dateScore * 0.3;
      if (dateScore > 0.8) matchingFactors.push('birth date match');
    }
    
    // Location match
    if (person.birthPlace && potentialMatch.location) {
      const locationScore = this.calculateLocationSimilarity(person.birthPlace, potentialMatch.location);
      confidence += locationScore * 0.3;
      if (locationScore > 0.7) matchingFactors.push('location match');
    }
    
    const recommendation = confidence > 0.8 ? 'accept' : confidence > 0.6 ? 'review' : 'reject';
    
    return {
      confidence: Math.min(confidence, 1.0),
      reasoning: `Rule-based analysis using name (${Math.round(nameScore * 100)}%), date, and location matching`,
      matchingFactors,
      concerns: confidence < 0.6 ? ['Low overall match confidence'] : [],
      recommendation,
      analyzedAt: new Date(),
      method: 'fallback'
    };
  }

  /**
   * Calculate similarity between two names (0-1)
   */
  calculateNameSimilarity(name1, name2) {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(
      name1.toLowerCase(), 
      name2.toLowerCase()
    );
    const maxLength = Math.max(name1.length, name2.length);
    return 1 - (distance / maxLength);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate date similarity (0-1)
   */
  calculateDateSimilarity(date1, date2) {
    const year1 = this.extractYear(date1);
    const year2 = this.extractYear(date2);
    
    if (!year1 || !year2) return 0;
    
    const yearDiff = Math.abs(year1 - year2);
    
    if (yearDiff === 0) return 1.0;
    if (yearDiff <= 2) return 0.9;
    if (yearDiff <= 5) return 0.7;
    if (yearDiff <= 10) return 0.5;
    return 0.2;
  }

  /**
   * Calculate location similarity (0-1)
   */
  calculateLocationSimilarity(loc1, loc2) {
    if (!loc1 || !loc2) return 0;
    
    const normalized1 = loc1.toLowerCase().replace(/[.,]/g, '');
    const normalized2 = loc2.toLowerCase().replace(/[.,]/g, '');
    
    // Exact match
    if (normalized1 === normalized2) return 1.0;
    
    // Check if one contains the other
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
      return 0.8;
    }
    
    // Word overlap
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');
    const commonWords = words1.filter(word => words2.includes(word));
    
    if (commonWords.length > 0) {
      return commonWords.length / Math.max(words1.length, words2.length);
    }
    
    return 0;
  }
}

module.exports = { AIGenealogyService };