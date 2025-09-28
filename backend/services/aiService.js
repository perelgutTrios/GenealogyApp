const OpenAI = require('openai');
const axios = require('axios');
const { NameMatchingService } = require('./nameMatchingService');
const { GenealogyValidationService } = require('./genealogyValidationService');

class AIGenealogyService {
  constructor() {
    // Initialize providers if keys available
    this.openai = process.env.OPENAI_API_KEY
      ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      : null;
    this.geminiApiKey = process.env.GEMINI_API_KEY || null;
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
  this._geminiResolvedModel = null; // cache a working model id
    this.familySearchToken = process.env.FAMILYSEARCH_API_KEY;
    this.ancestryApiKey = process.env.ANCESTRY_API_KEY;
    
    // Initialize advanced name matching service
    this.nameMatchingService = new NameMatchingService();
    
    // Initialize genealogy validation service
    this.validationService = new GenealogyValidationService();
  }

  /**
   * Provider-agnostic JSON generation helper
   * Tries Gemini first (free tier friendly), then OpenAI; returns parsed JSON or throws.
   */
  async generateJsonWithAI({ systemPrompt, userPrompt, maxTokens = 1500, temperature = 0.5, jsonSchema = null, enableWebGrounding = undefined }) {
    const tryParseJson = (text) => {
      try {
        return JSON.parse(text);
      } catch (e) {
        // Attempt to extract JSON from within code fences or surrounding prose
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const candidate = text.substring(start, end + 1);
          return JSON.parse(candidate);
        }
        throw e;
      }
    };
    // Try Gemini first (prefer v1beta with advanced features)
    if (this.geminiApiKey) {
      const prompt = `${userPrompt}\n\nReturn ONLY valid JSON, no prose.`;
      const bases = [
        'https://generativelanguage.googleapis.com/v1beta',
        'https://generativelanguage.googleapis.com/v1'
      ];
      const discovered = await this._discoverGeminiModelsSafe();
      const preferred = [this.geminiModel, 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro', 'gemini-1.5-flash-latest']
        .filter(Boolean);
      const modelsToTry = Array.from(new Set([
        ...(this._geminiResolvedModel ? [this._geminiResolvedModel] : []),
        ...preferred,
        ...discovered
      ]));

      for (const baseUrl of bases) {
        for (const modelName of modelsToTry) {
          try {
            const url = `${baseUrl}/models/${modelName}:generateContent?key=${this.geminiApiKey}`;
            const isBeta = baseUrl.endsWith('v1beta');
            const enableGrounding = enableWebGrounding ?? (process.env.GEMINI_ENABLE_WEB_GROUNDING === 'true');
            const body = isBeta
              ? {
                  // v1beta supports systemInstruction and structured JSON
                  systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
                  contents: [{ role: 'user', parts: [{ text: prompt }] }],
                  generationConfig: {
                    temperature,
                    maxOutputTokens: Math.min(8192, Math.max(256, maxTokens)),
                    responseMimeType: 'application/json',
                    ...(jsonSchema ? { responseSchema: jsonSchema } : {})
                  },
                  safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_SEXUAL_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' }
                  ],
                  ...(enableGrounding ? { tools: [{ googleSearchRetrieval: {} }] } : {})
                }
              : {
                  // v1 fallback without advanced fields
                  contents: [
                    { role: 'user', parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }
                  ],
                  generationConfig: {
                    temperature,
                    maxOutputTokens: Math.min(8192, Math.max(256, maxTokens))
                  }
                };
            const resp = await axios.post(url, body, { timeout: 20000 });

            const text = resp.data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
            this._geminiResolvedModel = modelName; // cache working model
            return tryParseJson(text);
          } catch (err) {
            const status = err.response?.status;
            const data = err.response?.data;
            const msg = data?.error?.message || err.message;
            console.warn(`⚠️ Gemini (${baseUrl.split('/').pop()}/${modelName}) failed [${status || 'ERR'}]: ${msg}`);
            // Try next model on 400/404 (unsupported/not found)
            if (status === 404 || status === 400) continue;
            // For auth/quota issues, stop trying Gemini and fall back to OpenAI
            if ([401, 403, 429].includes(status)) break;
            // Otherwise, try next model
          }
        }
      }
    }

    // Fallback to OpenAI if available
    if (this.openai) {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature,
        max_tokens: maxTokens
      });
      const content = response.choices?.[0]?.message?.content || '{}';
      return tryParseJson(content);
    }

    throw new Error('No AI provider configured. Set GEMINI_API_KEY or OPENAI_API_KEY.');
  }

  // Discover available Gemini models that support generateContent
  async _discoverGeminiModelsSafe() {
    try {
      const models = await this._listGeminiModels();
      const usable = models
        .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
        .map(m => m.name?.replace(/^models\//, ''));
      if (usable.length) {
        console.log(`🔎 Gemini models detected: ${usable.slice(0, 5).join(', ')}${usable.length > 5 ? '…' : ''}`);
      } else {
        console.warn('⚠️ No usable Gemini models with generateContent found via list API');
      }
      return usable;
    } catch (e) {
      console.warn('⚠️ Gemini model discovery failed:', e.message);
      return [];
    }
  }

  async _listGeminiModels() {
    const urls = [
      `https://generativelanguage.googleapis.com/v1/models?key=${this.geminiApiKey}`,
      `https://generativelanguage.googleapis.com/v1beta/models?key=${this.geminiApiKey}`
    ];
    for (const url of urls) {
      try {
        const res = await axios.get(url, { timeout: 10000 });
        const list = res.data?.models || [];
        if (list.length) return list;
      } catch (e) {
        // try next
      }
    }
    return [];
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
      const searchStrategies = await this.generateJsonWithAI({
        systemPrompt: 'You are an expert genealogist specializing in record research and name variations.',
        userPrompt: prompt,
        temperature: 0.7,
        maxTokens: 1500
      });
      const valid = searchStrategies &&
        Array.isArray(searchStrategies.nameVariations) && searchStrategies.nameVariations.length > 0 &&
        Array.isArray(searchStrategies.locationVariations) &&
        Array.isArray(searchStrategies.timeRangeQueries) &&
        Array.isArray(searchStrategies.contextualSearches) &&
        Array.isArray(searchStrategies.recordTypeTargets);
      console.log('✅ Generated', Object.keys(searchStrategies || {}).length, 'search strategy categories');

      if (!valid) {
        console.warn('⚠️ AI returned missing/empty strategy fields; using fallback rule-based generation');
        return this.generateFallbackQueries(person);
      }
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
   * Generate advanced name variations using the enhanced name matching service
   */
  generateNameVariations(givenNames, familyNames) {
    const variations = new Set();
    
    // Original name
    variations.add(`${givenNames} ${familyNames}`);
    
    // Use advanced name matching service for comprehensive variations
    const person = { givenNames, familyNames };
    
    // Generate nickname variations
    const givenNameVariations = this.nameMatchingService.getNicknameVariations(givenNames || '');
    const familyNameVariations = this.nameMatchingService.getSpellingVariations(familyNames || '');
    const culturalVariations = this.nameMatchingService.getCulturalVariations(givenNames || '');
    
    // Combine given name variations with family name
    givenNameVariations.forEach(givenVar => {
      if (givenVar && familyNames) {
        variations.add(`${givenVar} ${familyNames}`);
      }
    });
    
    // Combine original given name with family name variations
    familyNameVariations.forEach(familyVar => {
      if (givenNames && familyVar) {
        variations.add(`${givenNames} ${familyVar}`);
      }
    });
    
    // Add cultural variations
    culturalVariations.forEach(culturalVar => {
      if (culturalVar && familyNames) {
        variations.add(`${culturalVar} ${familyNames}`);
      }
    });
    
    // Initial patterns
    if (givenNames) {
      const firstInitial = givenNames.charAt(0);
      variations.add(`${firstInitial} ${familyNames}`);
      variations.add(`${firstInitial}. ${familyNames}`);
      
      // Middle initial patterns if multiple given names
      const nameParts = givenNames.split(/\s+/);
      if (nameParts.length > 1) {
        const initials = nameParts.map(part => part.charAt(0)).join('.');
        variations.add(`${initials} ${familyNames}`);
        variations.add(`${nameParts[0]} ${initials.charAt(2)} ${familyNames}`);
      }
    }
    
    console.log(`🎯 Generated ${variations.size} name variations for ${givenNames} ${familyNames}`);
    return Array.from(variations).filter(v => v.trim().length > 0);
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
- Source: ${potentialMatch.source}
- Additional Info: ${potentialMatch.additionalInfo || 'None'}

CRITICAL: First check if this is mock/test data that should be rejected outright.

Provide analysis as JSON:
{
  "confidence": 0.85,
  "reasoning": "Detailed explanation of match factors and data quality assessment",
  "matchingFactors": ["name similarity", "birth date match", "location match"],
  "concerns": ["any conflicting information", "mock/test data flags"],
  "recommendation": "accept|review|reject"
}

Consider:
- Name variations and cultural spellings
- Historical location changes
- Date recording variations
- Family context clues
- Record reliability by source type
- MOCK/TEST DATA DETECTION: Flag records with "Mock", "Test", "Example", "Sample", "Demo" locations/names
- Generic placeholders like "Mock Cemetery", "Test City", "Example County"
- Obviously fake data patterns that could mislead genealogical research`;

    try {
      const analysis = await this.generateJsonWithAI({
        systemPrompt: 'You are an expert genealogist. Analyze record matches carefully and respond with valid JSON only.',
        userPrompt: prompt,
        temperature: 0.3,
        maxTokens: 800
      });
      const valid = analysis && typeof analysis.confidence === 'number' &&
        typeof analysis.reasoning === 'string' &&
        Array.isArray(analysis.matchingFactors) &&
        Array.isArray(analysis.concerns) &&
        typeof analysis.recommendation === 'string';
      console.log('✅ AI match analysis complete:', analysis?.confidence);

      if (!valid) {
        console.warn('⚠️ AI returned incomplete match analysis; using enhanced fallback');
        return this.fallbackMatchAnalysis(person, potentialMatch);
      }
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
   * Enhanced fallback rule-based match analysis with comprehensive validation
   */
  fallbackMatchAnalysis(person, potentialMatch) {
    console.log('🔄 Using enhanced fallback match analysis with validation');
    
    let confidence = 0;
    const matchingFactors = [];
    const concerns = [];
    
    // STEP 1: Comprehensive person record validation
    console.log('🛡️ Running comprehensive person validation...');
    const personValidation = this.validationService.validatePersonRecord(person);
    const matchValidation = this.validationService.validatePersonRecord({
      givenNames: this.extractGivenName(potentialMatch.name),
      familyNames: this.extractFamilyName(potentialMatch.name),
      birthDate: potentialMatch.birth,
      deathDate: potentialMatch.death,
      birthPlace: potentialMatch.location
    });
    
    // Add validation concerns
    if (personValidation.issues.length > 0) {
      concerns.push(`Source record issues: ${personValidation.issues.map(i => i.message).join(', ')}`);
    }
    
    if (matchValidation.issues.length > 0) {
      concerns.push(`Match record issues: ${matchValidation.issues.map(i => i.message).join(', ')}`);
    }
    
    // STEP 2: Check for mock/test/placeholder data
    const mockDataFlags = this.detectMockData(potentialMatch);
    if (mockDataFlags.length > 0) {
      concerns.push(...mockDataFlags);
      confidence = Math.max(confidence * 0.1, 0.05); // Severely reduce confidence for mock data
      console.log('🚨 Mock/test data detected:', mockDataFlags);
    }
    
    // Advanced name similarity using the enhanced name matching service
    const nameMatchResult = this.nameMatchingService.matchFullNames(
      { 
        givenNames: person.givenNames, 
        familyNames: person.familyNames,
        maidenName: person.maidenName 
      },
      { 
        givenNames: this.extractGivenName(potentialMatch.name),
        familyNames: this.extractFamilyName(potentialMatch.name)
      },
      { 
        usePhoneticMatching: false, // Can be made configurable
        allowNicknames: true,
        allowCultural: true,
        allowSpellingVariations: true
      }
    );
    
    const nameScore = nameMatchResult.overallScore;
    if (!mockDataFlags.length) confidence += nameScore * 0.4; // Only add if not mock data
    
    // Enhanced matching factors based on detailed analysis
    if (nameMatchResult.details.givenMatch) matchingFactors.push('given name match');
    if (nameMatchResult.details.familyMatch) matchingFactors.push('family name match');
    if (nameMatchResult.maidenNameScore > 0.7) matchingFactors.push('maiden name match');
    if (nameMatchResult.details.strongMatch) matchingFactors.push('strong name match');
    
    console.log(`🎯 Name matching score: ${Math.round(nameScore * 100)}% (Given: ${Math.round(nameMatchResult.givenNameScore * 100)}%, Family: ${Math.round(nameMatchResult.familyNameScore * 100)}%)`);
    
    // Birth date proximity and age validation
    if (person.birthDate && potentialMatch.birth) {
      const dateScore = this.calculateDateSimilarity(person.birthDate, potentialMatch.birth);
      const ageValidation = this.validateAge(person.birthDate, potentialMatch.death || potentialMatch.recordDate || new Date().getFullYear());
      
      if (!ageValidation.isValid) {
        concerns.push(`🚨 IMPOSSIBLE AGE: ${ageValidation.reason}`);
        confidence = Math.max(confidence * 0.1, 0.05); // Severely reduce confidence for impossible ages
      } else {
        if (!mockDataFlags.length) confidence += dateScore * 0.3; // Only add if not mock data
        if (dateScore > 0.8) matchingFactors.push('birth date match');
        if (ageValidation.isReasonable) matchingFactors.push('reasonable lifespan');
      }
    }
    
    // Location match
    if (person.birthPlace && potentialMatch.location) {
      const locationScore = this.calculateLocationSimilarity(person.birthPlace, potentialMatch.location);
      if (!mockDataFlags.length) confidence += locationScore * 0.3; // Only add if not mock data
      if (locationScore > 0.7) matchingFactors.push('location match');
    }
    
    // STEP 5: Apply validation scores to confidence
    const avgValidationScore = (personValidation.validationScore + matchValidation.validationScore) / 2;
    if (!mockDataFlags.length) {
      confidence *= avgValidationScore; // Reduce confidence based on validation issues
    }
    
    // STEP 6: Data quality assessment impact
    const avgQualityScore = (
      (personValidation.qualityAssessment?.score || 0.5) + 
      (matchValidation.qualityAssessment?.score || 0.5)
    ) / 2;
    
    if (!mockDataFlags.length) {
      confidence *= (0.7 + (avgQualityScore * 0.3)); // Quality impacts confidence
    }
    
    // Add quality insights to matching factors
    if (avgQualityScore > 0.8) {
      matchingFactors.push('high data quality');
    } else if (avgQualityScore < 0.5) {
      concerns.push('Low data quality detected');
    }
    
    // STEP 7: Determine recommendation with comprehensive analysis
    let recommendation;
    if (mockDataFlags.length > 0) {
      recommendation = 'reject';
    } else if (personValidation.issues.filter(i => i.severity === 'error').length > 0 || 
               matchValidation.issues.filter(i => i.severity === 'error').length > 0) {
      recommendation = 'reject'; // Reject if validation errors
    } else {
      recommendation = confidence > 0.8 ? 'accept' : confidence > 0.6 ? 'review' : 'reject';
    }
    
    // Enhanced reasoning with comprehensive analysis
    let reasoning = `Enhanced analysis: Name matching (${Math.round(nameScore * 100)}%), ` +
                   `validation score (${Math.round(avgValidationScore * 100)}%), ` +
                   `data quality (${Math.round(avgQualityScore * 100)}%)`;
    
    if (mockDataFlags.length > 0) {
      reasoning += ` - FLAGGED: Contains mock/test data patterns`;
    }
    
    console.log(`🎯 Enhanced analysis complete: ${Math.round(confidence * 100)}% confidence, ${recommendation} recommendation`);
    
    return {
      confidence: Math.min(confidence, 1.0),
      reasoning,
      matchingFactors,
      concerns: concerns.length > 0 ? concerns : (confidence < 0.6 ? ['Low overall match confidence'] : []),
      recommendation,
      validation: {
        personValidation: {
          score: personValidation.validationScore,
          quality: personValidation.qualityAssessment,
          issues: personValidation.issues.length,
          warnings: personValidation.warnings.length
        },
        matchValidation: {
          score: matchValidation.validationScore,
          quality: matchValidation.qualityAssessment,
          issues: matchValidation.issues.length,
          warnings: matchValidation.warnings.length
        }
      },
      analyzedAt: new Date(),
      method: 'enhanced_fallback'
    };
  }

  /**
   * Detect mock, test, or placeholder data in genealogical records
   */
  detectMockData(record) {
    const flags = [];
    const mockPatterns = [
      // Common test/mock indicators
      /mock/i, /test/i, /example/i, /sample/i, /demo/i, /placeholder/i,
      /fake/i, /dummy/i, /temp/i, /temporary/i,
      
      // Generic/template patterns
      /^(first|last)\s+(name|surname)$/i,
      /^(john|jane)\s+(doe|smith)$/i,
      /^(unknown|n\/a|tbd|tba)$/i,
      
      // Date patterns that suggest test data
      /^(01\/01\/|12\/31\/|1900|2000|9999)/,
      
      // Location patterns
      /^(mock|test|example|sample|demo|fake|dummy)\s+(city|town|county|state|country|cemetery|location)/i,
      /^(anytown|somewhere|nowhere|unknown\s+location)/i
    ];
    
    // Check all record fields for mock patterns
    const fieldsToCheck = [
      record.name,
      record.location,
      record.birth,
      record.death,
      record.source,
      record.description
    ];
    
    fieldsToCheck.forEach((field, index) => {
      if (!field) return;
      
      const fieldStr = field.toString();
      mockPatterns.forEach(pattern => {
        if (pattern.test(fieldStr)) {
          const fieldNames = ['name', 'location', 'birth date', 'death date', 'source', 'description'];
          flags.push(`🚨 MOCK/TEST DATA: ${fieldNames[index]} contains "${fieldStr}"`);
        }
      });
    });
    
    // Specific checks for genealogy record quality
    if (record.source && /findagrave/i.test(record.source) && /mock.*cemetery/i.test(record.location)) {
      flags.push('🚨 MOCK/TEST DATA: FindAGrave record with mock cemetery location');
    }
    
    if (record.location && record.location.includes('Mock City')) {
      flags.push('🚨 MOCK/TEST DATA: Contains "Mock City" - clearly test data');
    }
    
    return flags;
  }

  /**
   * Validate age calculations for genealogical records
   */
  validateAge(birthDate, endDate) {
    try {
      const birth = this.parseDate(birthDate);
      const end = this.parseDate(endDate);
      
      if (!birth || !end) {
        return { isValid: true, isReasonable: true, reason: 'Unable to calculate age - insufficient date data' };
      }

      const ageYears = end.getFullYear() - birth.getFullYear();
      
      // Account for month/day differences for more accurate age
      let adjustedAge = ageYears;
      if (end.getMonth() < birth.getMonth() || 
          (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate())) {
        adjustedAge--;
      }

      // Age validation rules for genealogy
      if (adjustedAge < 0) {
        return { 
          isValid: false, 
          isReasonable: false, 
          reason: `Birth date (${birthDate}) is after record date (${endDate})`,
          calculatedAge: adjustedAge
        };
      }

      if (adjustedAge > 122) { // Oldest verified human was 122 years
        return { 
          isValid: false, 
          isReasonable: false, 
          reason: `Calculated age of ${adjustedAge} years exceeds maximum human lifespan (birth: ${birthDate}, record: ${endDate})`,
          calculatedAge: adjustedAge
        };
      }

      if (adjustedAge > 110) {
        return { 
          isValid: true, 
          isReasonable: false, 
          reason: `Age of ${adjustedAge} years is extremely rare but possible`,
          calculatedAge: adjustedAge
        };
      }

      return { 
        isValid: true, 
        isReasonable: true, 
        reason: `Reasonable age of ${adjustedAge} years`,
        calculatedAge: adjustedAge
      };

    } catch (error) {
      return { isValid: true, isReasonable: true, reason: 'Error calculating age', error: error.message };
    }
  }

  /**
   * Parse various date formats commonly found in genealogical records
   */
  parseDate(dateStr) {
    if (!dateStr) return null;
    
    // Convert to string and clean up
    const cleaned = dateStr.toString().trim();
    
    // Handle year-only dates
    if (/^\d{4}$/.test(cleaned)) {
      return new Date(parseInt(cleaned), 0, 1);
    }
    
    // Handle various date formats
    const patterns = [
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,  // MM/DD/YYYY
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/,   // YYYY-MM-DD
      /^(\d{1,2})\s+(\w+)\s+(\d{4})$/,   // DD MON YYYY
    ];
    
    for (const pattern of patterns) {
      const match = cleaned.match(pattern);
      if (match) {
        if (pattern === patterns[0]) { // MM/DD/YYYY
          return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
        } else if (pattern === patterns[1]) { // YYYY-MM-DD
          return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
        }
      }
    }
    
    // Fallback to Date parsing
    try {
      const parsed = new Date(cleaned);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
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

  /**
   * Extract given name from full name string
   */
  extractGivenName(fullName) {
    if (!fullName) return '';
    
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return '';
    
    // For names like "John Smith" or "Mary Jane Smith", assume all but last is given name
    if (parts.length > 1) {
      return parts.slice(0, -1).join(' ');
    }
    
    // Single name - could be given or family name, default to given
    return parts[0];
  }

  /**
   * Extract family name from full name string  
   */
  extractFamilyName(fullName) {
    if (!fullName) return '';
    
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return '';
    
    // Assume last part is family name
    return parts[parts.length - 1];
  }
}

module.exports = { AIGenealogyService };