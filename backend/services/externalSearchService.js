const axios = require('axios');

class FamilySearchService {
  constructor() {
    this.baseURL = 'https://api.familysearch.org';
    this.accessToken = null;
    this.sessionId = null;
    this.defaults = {
      maxNameVariations: 12,
      maxLocationVariations: 3,
      maxRequests: 30,
      delayMs: 300
    };
  }

  /**
   * Authenticate with FamilySearch API
   */
  async authenticate() {
    try {
      console.log('🔑 Authenticating with FamilySearch API...');
      // FamilySearch expects urlencoded form data
      const form = new URLSearchParams();
      form.append('grant_type', 'client_credentials');
      if (process.env.FAMILYSEARCH_CLIENT_ID) form.append('client_id', process.env.FAMILYSEARCH_CLIENT_ID);
      if (process.env.FAMILYSEARCH_CLIENT_SECRET) form.append('client_secret', process.env.FAMILYSEARCH_CLIENT_SECRET);
      const response = await axios.post(`${this.baseURL}/platform/oauth2/token`, form.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        // Ensure we don't hang silently if the endpoint is slow/unreachable
        timeout: 10000
      });
      
      this.accessToken = response.data.access_token;
      console.log('✅ FamilySearch authentication successful');
      return true;
      
    } catch (error) {
      const reason = error.code === 'ECONNABORTED' ? 'timeout' : error.message;
      console.error('❌ FamilySearch authentication failed:', reason);
      return false;
    }
  }

  /**
   * Search for persons matching the given criteria
   */
  async searchPersons(searchQueries, person) {
    if (!this.accessToken) {
      const auth = await this.authenticate();
      console.log(`ℹ️ FamilySearch auth result: ${auth ? 'SUCCESS' : 'FAILURE'}`);
      if (!auth) return [];
    }

    console.log('🔍 Searching FamilySearch for:', person.givenNames, person.familyNames);
    
    const results = [];
    const opts = {
      ...this.defaults,
      ...(searchQueries?.options || {})
    };
    let requestCount = 0;
    
    try {
      const nameVars = (searchQueries.nameVariations || []).slice(0, opts.maxNameVariations);
      const locVars = (searchQueries.locationVariations || []).slice(0, opts.maxLocationVariations);
      const timeRanges = (searchQueries.timeRangeQueries || []).slice(0, 3);

      // Ensure at least one location attempt
      const locationsToTry = locVars.length > 0 ? locVars : [person.birthPlace].filter(Boolean);

      for (const nameVariation of nameVars) {
        for (const loc of locationsToTry) {
          // For each time window, or at least once
          const windows = timeRanges.length ? timeRanges : [null];
          for (const tr of windows) {
            if (requestCount >= opts.maxRequests) break;
            const searchParams = this.buildSearchParams(nameVariation, person, searchQueries, loc, tr);

            const response = await axios.get(`${this.baseURL}/platform/tree/search`, {
              headers: {
                'Authorization': `Bearer ${this.accessToken}`,
                'Accept': 'application/json'
              },
              params: searchParams
            });

            requestCount++;
            if (response.data.entries) {
              const parsedResults = this.parseSearchResults(response.data.entries, nameVariation);
              results.push(...parsedResults);
            }

            await this.sleep(opts.delayMs);
          }
          if (requestCount >= opts.maxRequests) break;
        }
        if (requestCount >= opts.maxRequests) break;
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
  buildSearchParams(nameQuery, person, searchQueries, locationOverride = null, timeRange = null) {
    const params = {};
    
    // Parse name from query
    const nameParts = nameQuery.split(' ');
    if (nameParts.length >= 2) {
      params.givenName = nameParts.slice(0, -1).join(' ');
      params.familyName = nameParts[nameParts.length - 1];
    }
    
    // Add birth information if available
    if (timeRange && /^(\d{4})-(\d{4})$/.test(timeRange)) {
      const m = timeRange.match(/^(\d{4})-(\d{4})$/);
      const y1 = parseInt(m[1], 10);
      const y2 = parseInt(m[2], 10);
      // Midpoint and range
      params.birthYear = Math.round((y1 + y2) / 2);
      params.birthYearRange = String(Math.ceil((y2 - y1) / 2));
    } else if (person.birthDate) {
      const birthYear = this.extractYear(person.birthDate);
      if (birthYear) {
        params.birthYear = birthYear;
        params.birthYearRange = '10'; // ±10 years
      }
    }
    
    const preferredLoc = locationOverride || (searchQueries.locationVariations?.[0]) || person.birthPlace;
    if (preferredLoc) params.birthPlace = preferredLoc;
    
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
    console.log('🪦 FindAGrave search skipped: no public API available. Implement real integration before enabling.');
    return [];
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
    console.log('📰 Newspaper search skipped: no real provider configured. Implement integration before enabling.');
    return [];
  }
}

/**
 * WikiTree - Collaborative family tree (public API)
 * Docs: https://www.wikitree.com/wiki/Help:WikiTree_API
 */
class WikiTreeService {
  constructor() {
    this.baseURL = process.env.WIKITREE_API_BASE || 'https://api.wikitree.com/api.php';
    this.appId = process.env.WIKITREE_APP_ID || 'GenealogyApp';
  }

  /**
   * Search for profiles by name (and optionally year)
   */
  async searchProfiles(searchQueries, person) {
    const fullName = `${person.givenNames || ''} ${person.familyNames || ''}`.trim();
    if (!fullName) {
      console.log('🌳 WikiTree skipped: no name provided');
      return [];
    }

    // Try to derive a birth year window to help narrow results
    let birthYear = null;
    const tr = (searchQueries.timeRangeQueries || [])[0];
    if (tr && /^(\d{4})-(\d{4})$/.test(tr)) {
      const m = tr.match(/^(\d{4})-(\d{4})$/);
      birthYear = Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2);
    } else if (person.birthDate) {
      const by = (person.birthDate.match(/\b(16|17|18|19|20)\d{2}\b/) || [])[0];
      birthYear = by ? parseInt(by, 10) : null;
    }

    console.log(`🌳 Searching WikiTree for "${fullName}"${birthYear ? ' ~' + birthYear : ''}...`);

    const attempts = [ { action: 'search', termKey: 'find' } ];

    for (const attempt of attempts) {
      try {
        const form = new URLSearchParams();
        form.append('action', attempt.action);
        form.append(attempt.termKey, fullName);
        form.append('appId', this.appId);
        form.append('max', '10');
        form.append('format', 'json');
        if (birthYear) form.append('birth', String(birthYear));

        const resp = await axios.post(this.baseURL, form.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000
        });

        const data = resp.data;
        const items = Array.isArray(data?.results) ? data.results
          : Array.isArray(data?.people) ? data.people
          : Array.isArray(data) ? data
          : [];

        if (!items.length) {
          // try next attempt
          continue;
        }

        const results = items.slice(0, 10).map((it, idx) => {
          // Common WikiTree fields across responses
          const wtId = it?.Name || it?.NameKey || it?.Id || it?.identifier || it?.wtid;
          const displayName = it?.LongName || it?.RealName || it?.DisplayName || it?.PersonName || it?.name || fullName;
          const birth = it?.BirthDate || it?.birth_date || it?.BirthDateDecade || it?.Birth || person.birthDate || '';
          const birthLoc = it?.BirthLocation || it?.birth_location || it?.BirthPlace || '';
          const url = it?.Url || it?.url || (wtId ? `https://www.wikitree.com/wiki/${wtId}` : '');

          return {
            id: (wtId || `${displayName}_${idx}`).toString(),
            source: 'WikiTree',
            name: displayName,
            birth: birth,
            location: birthLoc,
            url,
            additionalInfo: 'Collaborative family tree profile',
            confidence: 0.6,
            rawData: it
          };
        });

        console.log(`✅ WikiTree found ${results.length} potential profiles`);
        return results;
      } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error || err.message;
        console.warn(`❌ WikiTree ${attempt.action} failed [${status || 'ERR'}]: ${msg}`);
        // try next variant
      }
    }

    console.log('ℹ️ WikiTree returned no results');
    return [];
  }

  async getProfileDetails(wtId) {
    if (!wtId) return null;
    try {
      const form = new URLSearchParams();
      form.append('action', 'getProfile');
      form.append('key', wtId);
      form.append('format', 'json');
      const resp = await axios.post(this.baseURL, form.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000
      });
      return resp.data || null;
    } catch (e) {
      console.warn('⚠️ WikiTree getProfile failed:', e.message);
      return null;
    }
  }
}

/**
 * Chronicling America (Library of Congress) - Public Newspaper API
 * Docs: https://chroniclingamerica.loc.gov/about/api/
 */
class ChroniclingAmericaService {
  constructor() {
    this.baseURL = process.env.CHRONICLING_AMERICA_API_BASE || 'https://chroniclingamerica.loc.gov';
  }

  /**
   * Search newspaper pages mentioning the person's name within a likely date range
   */
  async searchArticles(searchQueries, person) {
    try {
      const fullName = `${person.givenNames || ''} ${person.familyNames || ''}`.trim();
      if (!fullName) {
        console.log('🗞️ Chronicling America skipped: no name');
        return [];
      }

      // Determine a reasonable year range
      let fromYear = 1800;
      let toYear = 1963; // dataset coverage generally up to 1963
      const tr = (searchQueries.timeRangeQueries || [])[0];
      if (tr && /^(\d{4})-(\d{4})$/.test(tr)) {
        const m = tr.match(/^(\d{4})-(\d{4})$/);
        fromYear = parseInt(m[1], 10);
        toYear = parseInt(m[2], 10);
      } else if (person.birthDate) {
        const by = (person.birthDate.match(/\b(18|19|20)\d{2}\b/) || [])[0];
        if (by) {
          const birthYear = parseInt(by, 10);
          fromYear = Math.max(1800, birthYear - 5);
          toYear = Math.min(1963, birthYear + 40);
        }
      }

      console.log(`🗞️ Searching Chronicling America for "${fullName}" (${fromYear}-${toYear})...`);

      const params = {
        format: 'json',
        proxtext: fullName,
        dateFilterType: 'yearRange',
        date1: fromYear,
        date2: toYear,
        rows: 10,
        page: 1
      };

      const url = `${this.baseURL}/search/pages/results/`;
      const response = await axios.get(url, { params, timeout: 10000 });

      const items = response.data && (response.data.items || response.data.items_found || response.data.results || []);
      if (!Array.isArray(items) || items.length === 0) {
        console.log('ℹ️ Chronicling America returned no items');
        return [];
      }

      // Normalize a subset of fields; fall back defensively if schema differs
      const results = items.slice(0, 10).map((it, idx) => {
        const title = it.title || it.headline || it.section || 'Newspaper Page';
        const date = it.date || it.issueDate || it.year || '';
        const url = it.id || it.url || it.link || '';
        const place = it.place_of_publication || it.place || '';
        return {
          id: (it.id || it.url || `${title}_${date}_${idx}`).toString(),
          source: 'Chronicling America',
          name: fullName,
          birth: person.birthDate || 'Unknown',
          location: place || person.birthPlace || 'Unknown',
          url,
          additionalInfo: `${title}${date ? ' (' + String(date).slice(0, 10) + ')' : ''}`.trim(),
          confidence: 0.5, // neutral baseline; later scoring can refine
          rawData: it
        };
      });

      console.log(`✅ Chronicling America found ${results.length} potential mentions`);
      return results;
    } catch (error) {
      const reason = error.code === 'ECONNABORTED' ? 'timeout' : error.message;
      console.warn('❌ Chronicling America search failed:', reason);
      return [];
    }
  }

  async getArticleDetails(recordId) {
    // Optional: could re-fetch by URL; for now, details are provided in rawData in search results
    return null;
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
    this.chronicling = new ChroniclingAmericaService();
    this.wikitree = new WikiTreeService();
  }

  /**
   * Search all external sources for a person
   */
  async searchAllSources(searchQueries, person) {
    console.log('🌐 Starting comprehensive external search...');
    const opts = {
      ...(searchQueries?.options || {})
    };
    // Disable mock sources by default unless explicitly enabled via options or env
    const enableMocks = opts.enableMocks ?? (process.env.ENABLE_MOCK_SOURCES === 'true');
    const sources = {
      familySearch: true,
      chroniclingAmerica: true,
      wikitree: true,
      findAGrave: enableMocks,
      newspapers: enableMocks,
      ...(opts.sources || {})
    };

    const searchPromises = [];
    if (sources.familySearch) {
      searchPromises.push(this.familySearch.searchPersons(searchQueries, person));
    }
    if (sources.chroniclingAmerica) {
      searchPromises.push(this.chronicling.searchArticles(searchQueries, person));
    }
    if (sources.wikitree) {
      searchPromises.push(this.wikitree.searchProfiles(searchQueries, person));
    }
    if (sources.findAGrave) {
      searchPromises.push(this.findAGrave.searchBurialRecords(searchQueries, person));
    }
    if (sources.newspapers) {
      searchPromises.push(this.newspapers.searchNewspaperMentions(searchQueries, person));
    }

    try {
      const settled = await Promise.allSettled(searchPromises);
      const allResults = [];
      settled.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          allResults.push(...(res.value || []));
        } else {
          const label = idx < searchPromises.length ? 'Source' : 'Unknown';
          console.warn(`⚠️ ${label} search failed:`, res.reason);
        }
      });
      
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
      case 'Chronicling America':
        return await this.chronicling.getArticleDetails(recordId);
      case 'WikiTree':
        return await this.wikitree.getProfileDetails(recordId);
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
  ChroniclingAmericaService,
  WikiTreeService,
  ExternalSearchService
};