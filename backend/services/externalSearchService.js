const axios = require('axios');

class FamilySearchService {
  constructor() {
    this.baseURL = 'https://api.familysearch.org';
    this.accessToken = null;
    this.sessionId = null;
  }

  /**
   * Authenticate with FamilySearch API
   */
  async authenticate() {
    try {
      console.log('🔑 Authenticating with FamilySearch API...');
      
      const response = await axios.post(`${this.baseURL}/platform/oauth2/token`, {
        grant_type: 'client_credentials',
        client_id: process.env.FAMILYSEARCH_CLIENT_ID,
        client_secret: process.env.FAMILYSEARCH_CLIENT_SECRET
      }, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      
      this.accessToken = response.data.access_token;
      console.log('✅ FamilySearch authentication successful');
      return true;
      
    } catch (error) {
      console.error('❌ FamilySearch authentication failed:', error.message);
      return false;
    }
  }

  /**
   * Search for persons matching the given criteria
   */
  async searchPersons(searchQueries, person) {
    if (!this.accessToken) {
      const auth = await this.authenticate();
      if (!auth) return [];
    }

    console.log('🔍 Searching FamilySearch for:', person.givenNames, person.familyNames);
    
    const results = [];
    
    try {
      // Use the AI-generated search queries
      for (const nameVariation of searchQueries.nameVariations.slice(0, 5)) { // Limit to avoid rate limits
        const searchParams = this.buildSearchParams(nameVariation, person, searchQueries);
        
        const response = await axios.get(`${this.baseURL}/platform/tree/search`, {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Accept': 'application/json'
          },
          params: searchParams
        });
        
        if (response.data.entries) {
          const parsedResults = this.parseSearchResults(response.data.entries, nameVariation);
          results.push(...parsedResults);
        }
        
        // Rate limiting
        await this.sleep(500);
      }
      
      console.log(`✅ FamilySearch found ${results.length} potential matches`);
      return this.deduplicateResults(results);
      
    } catch (error) {
      console.error('❌ FamilySearch search failed:', error.message);
      return [];
    }
  }

  /**
   * Build search parameters for FamilySearch API
   */
  buildSearchParams(nameQuery, person, searchQueries) {
    const params = {};
    
    // Parse name from query
    const nameParts = nameQuery.split(' ');
    if (nameParts.length >= 2) {
      params.givenName = nameParts.slice(0, -1).join(' ');
      params.familyName = nameParts[nameParts.length - 1];
    }
    
    // Add birth information if available
    if (person.birthDate) {
      const birthYear = this.extractYear(person.birthDate);
      if (birthYear) {
        params.birthYear = birthYear;
        params.birthYearRange = '10'; // ±10 years
      }
    }
    
    if (person.birthPlace && searchQueries.locationVariations.length > 0) {
      params.birthPlace = searchQueries.locationVariations[0];
    }
    
    // Add parent information if available
    if (person.parents?.father?.givenNames) {
      params.fatherGivenName = person.parents.father.givenNames;
      params.fatherFamilyName = person.parents.father.familyNames;
    }
    
    if (person.parents?.mother?.givenNames) {
      params.motherGivenName = person.parents.mother.givenNames;
      params.motherFamilyName = person.parents.mother.familyNames;
    }
    
    return params;
  }

  /**
   * Parse search results from FamilySearch API response
   */
  parseSearchResults(entries, searchQuery) {
    return entries.map(entry => {
      const person = entry.content?.gedcomx?.persons?.[0];
      if (!person) return null;
      
      const names = person.names?.[0]?.nameForms?.[0]?.parts;
      const givenName = names?.find(p => p.type === 'Given')?.value || '';
      const familyName = names?.find(p => p.type === 'Family')?.value || '';
      
      const birthFact = person.facts?.find(f => f.type === 'Birth');
      const birthDate = birthFact?.date?.original || '';
      const birthPlace = birthFact?.place?.original || '';
      
      return {
        id: person.id,
        source: 'FamilySearch',
        name: `${givenName} ${familyName}`.trim(),
        givenName,
        familyName,
        birth: birthDate,
        location: birthPlace,
        searchQuery: searchQuery,
        url: `https://www.familysearch.org/tree/person/details/${person.id}`,
        additionalInfo: this.extractAdditionalInfo(person),
        confidence: this.calculateInitialConfidence(person, searchQuery),
        rawData: person
      };
    }).filter(result => result !== null);
  }

  /**
   * Extract additional information from person record
   */
  extractAdditionalInfo(person) {
    const info = [];
    
    // Death information
    const deathFact = person.facts?.find(f => f.type === 'Death');
    if (deathFact) {
      const deathDate = deathFact.date?.original || '';
      const deathPlace = deathFact.place?.original || '';
      if (deathDate || deathPlace) {
        info.push(`Death: ${deathDate} ${deathPlace}`.trim());
      }
    }
    
    // Other life events
    const otherFacts = person.facts?.filter(f => !['Birth', 'Death'].includes(f.type)) || [];
    otherFacts.slice(0, 3).forEach(fact => { // Limit to avoid clutter
      info.push(`${fact.type}: ${fact.value || fact.place?.original || 'Yes'}`);
    });
    
    return info.join('; ');
  }

  /**
   * Calculate initial confidence score
   */
  calculateInitialConfidence(person, searchQuery) {
    let confidence = 0.5; // Base confidence
    
    // Has birth information
    const birthFact = person.facts?.find(f => f.type === 'Birth');
    if (birthFact?.date) confidence += 0.2;
    if (birthFact?.place) confidence += 0.1;
    
    // Has death information (more complete record)
    const deathFact = person.facts?.find(f => f.type === 'Death');
    if (deathFact) confidence += 0.1;
    
    // Has multiple facts (richer record)
    if (person.facts?.length > 2) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Remove duplicate results
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(result => {
      const key = `${result.name}_${result.birth}_${result.location}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Extract year from date string
   */
  extractYear(dateString) {
    if (!dateString) return null;
    const yearMatch = dateString.match(/\b(18|19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }

  /**
   * Sleep utility for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class FindAGraveService {
  constructor() {
    this.baseURL = 'https://www.findagrave.com/api';
  }

  /**
   * Search FindAGrave for burial records
   * Note: This is a mock implementation - FindAGrave doesn't have public API
   * You would need to implement web scraping or use unofficial methods
   */
  async searchBurialRecords(searchQueries, person) {
    console.log('🪦 Searching FindAGrave for burial records...');
    
    // Mock implementation for demonstration
    // In real implementation, you'd use web scraping or unofficial API
    const mockResults = [
      {
        id: 'findagrave_mock_1',
        source: 'FindAGrave',
        name: `${person.givenNames} ${person.familyNames}`,
        birth: person.birthDate || 'Unknown',
        death: 'Unknown',
        location: 'Mock Cemetery, Mock City',
        url: 'https://www.findagrave.com/memorial/mock',
        additionalInfo: 'Burial information, family members',
        confidence: 0.6,
        memorialId: 'mock_123456'
      }
    ];
    
    console.log(`✅ FindAGrave mock found ${mockResults.length} potential matches`);
    return mockResults;
  }
}

class NewspaperSearchService {
  constructor() {
    this.newspapersApiKey = process.env.NEWSPAPERS_API_KEY;
  }

  /**
   * Search newspaper archives for mentions
   */
  async searchNewspaperMentions(searchQueries, person) {
    console.log('📰 Searching newspaper archives...');
    
    // Mock implementation - would integrate with Newspapers.com API or similar
    const mockResults = [
      {
        id: 'newspaper_mock_1',
        source: 'Newspaper Archives',
        name: `${person.givenNames} ${person.familyNames}`,
        birth: person.birthDate || 'Unknown',
        location: person.birthPlace || 'Unknown',
        url: 'https://newspapers.com/mock-article',
        additionalInfo: 'Wedding announcement, 1985',
        confidence: 0.7,
        articleType: 'Wedding Announcement',
        newspaper: 'Local Daily News',
        date: '1985-06-15'
      }
    ];
    
    console.log(`✅ Newspaper search mock found ${mockResults.length} potential matches`);
    return mockResults;
  }
}

/**
 * Unified external search service that aggregates results from multiple sources
 */
class ExternalSearchService {
  constructor() {
    this.familySearch = new FamilySearchService();
    this.findAGrave = new FindAGraveService();
    this.newspapers = new NewspaperSearchService();
  }

  /**
   * Search all external sources for a person
   */
  async searchAllSources(searchQueries, person) {
    console.log('🌐 Starting comprehensive external search...');
    
    const searchPromises = [
      this.familySearch.searchPersons(searchQueries, person),
      this.findAGrave.searchBurialRecords(searchQueries, person),
      this.newspapers.searchNewspaperMentions(searchQueries, person)
    ];

    try {
      const [familySearchResults, findAGraveResults, newspaperResults] = await Promise.allSettled(searchPromises);
      
      const allResults = [];
      
      // Aggregate results from all sources
      if (familySearchResults.status === 'fulfilled') {
        allResults.push(...familySearchResults.value);
      } else {
        console.warn('⚠️ FamilySearch search failed:', familySearchResults.reason);
      }
      
      if (findAGraveResults.status === 'fulfilled') {
        allResults.push(...findAGraveResults.value);
      } else {
        console.warn('⚠️ FindAGrave search failed:', findAGraveResults.reason);
      }
      
      if (newspaperResults.status === 'fulfilled') {
        allResults.push(...newspaperResults.value);
      } else {
        console.warn('⚠️ Newspaper search failed:', newspaperResults.reason);
      }
      
      console.log(`✅ External search complete: ${allResults.length} total results from all sources`);
      
      // Sort by confidence score
      return allResults.sort((a, b) => b.confidence - a.confidence);
      
    } catch (error) {
      console.error('❌ External search failed:', error.message);
      return [];
    }
  }

  /**
   * Get detailed record information from a specific source
   */
  async getRecordDetails(recordId, source) {
    switch (source) {
      case 'FamilySearch':
        return await this.familySearch.getPersonDetails(recordId);
      case 'FindAGrave':
        return await this.findAGrave.getMemorialDetails(recordId);
      case 'Newspaper Archives':
        return await this.newspapers.getArticleDetails(recordId);
      default:
        throw new Error(`Unknown source: ${source}`);
    }
  }
}

module.exports = {
  FamilySearchService,
  FindAGraveService,
  NewspaperSearchService,
  ExternalSearchService
};