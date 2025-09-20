/**
 * Advanced confidence scoring system for genealogical record matching
 * Uses multiple factors to determine likelihood of correct match
 */

class ConfidenceScorer {
  constructor() {
    // Weights for different matching factors
    this.weights = {
      nameMatch: 0.35,          // Most important factor
      dateMatch: 0.25,          // Very important for identification
      locationMatch: 0.20,      // Geographic context is crucial
      familyContext: 0.15,      // Family relationships add certainty
      recordQuality: 0.05       // Source reliability factor
    };

    // Thresholds for decision making
    this.thresholds = {
      autoAccept: 0.85,         // Automatically accept matches above this
      needsReview: 0.60,        // Flag for human review between these
      autoReject: 0.40          // Automatically reject below this
    };
  }

  /**
   * Calculate comprehensive confidence score for a potential match
   * @param {Object} person - Original person record
   * @param {Object} potentialMatch - Potential matching record
   * @param {Object} searchContext - Search query context
   * @returns {Object} Detailed confidence analysis
   */
  calculateConfidence(person, potentialMatch, searchContext = {}) {
    console.log('🎯 Calculating confidence score for match...');

    const scores = {
      nameMatch: this.scoreNameMatch(person, potentialMatch),
      dateMatch: this.scoreDateMatch(person, potentialMatch),
      locationMatch: this.scoreLocationMatch(person, potentialMatch),
      familyContext: this.scoreFamilyContext(person, potentialMatch),
      recordQuality: this.scoreRecordQuality(potentialMatch)
    };

    // Calculate weighted overall confidence
    const overallConfidence = Object.entries(scores).reduce((total, [factor, score]) => {
      return total + (score * this.weights[factor]);
    }, 0);

    // Generate detailed analysis
    const analysis = this.generateAnalysis(scores, overallConfidence, person, potentialMatch);

    console.log(`✅ Confidence calculation complete: ${Math.round(overallConfidence * 100)}%`);

    return {
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      scores,
      analysis,
      recommendation: this.getRecommendation(overallConfidence),
      calculatedAt: new Date(),
      matchingFactors: this.getMatchingFactors(scores),
      concerns: this.identifyConcerns(scores, person, potentialMatch)
    };
  }

  /**
   * Score name matching with various fuzzy matching techniques
   */
  scoreNameMatch(person, potentialMatch) {
    const personName = `${person.givenNames || ''} ${person.familyNames || ''}`.trim().toLowerCase();
    const matchName = (potentialMatch.name || '').toLowerCase();

    if (!personName || !matchName) return 0;

    // Exact match
    if (personName === matchName) return 1.0;

    // Calculate various similarity metrics
    const similarities = {
      levenshtein: this.levenshteinSimilarity(personName, matchName),
      jaro: this.jaroSimilarity(personName, matchName),
      soundex: this.soundexMatch(personName, matchName) ? 1.0 : 0.0,
      nicknames: this.nicknameMatch(person.givenNames, potentialMatch.name),
      initials: this.initialMatch(personName, matchName)
    };

    // Weight the different similarity measures
    const nameScore = (
      similarities.levenshtein * 0.3 +
      similarities.jaro * 0.3 +
      similarities.soundex * 0.2 +
      similarities.nicknames * 0.15 +
      similarities.initials * 0.05
    );

    return Math.min(nameScore, 1.0);
  }

  /**
   * Score date matching with various tolerances
   */
  scoreDateMatch(person, potentialMatch) {
    const personDate = person.birthDate;
    const matchDate = potentialMatch.birth;

    if (!personDate || !matchDate) return 0.3; // Neutral score for missing dates

    const personYear = this.extractYear(personDate);
    const matchYear = this.extractYear(matchDate);

    if (!personYear || !matchYear) return 0.3;

    const yearDiff = Math.abs(personYear - matchYear);

    // Scoring based on year difference
    if (yearDiff === 0) return 1.0;
    if (yearDiff === 1) return 0.95;
    if (yearDiff === 2) return 0.90;
    if (yearDiff <= 3) return 0.85;
    if (yearDiff <= 5) return 0.75;
    if (yearDiff <= 10) return 0.60;
    if (yearDiff <= 15) return 0.40;
    if (yearDiff <= 20) return 0.20;
    
    return 0.1; // Very different dates
  }

  /**
   * Score location matching with geographical intelligence
   */
  scoreLocationMatch(person, potentialMatch) {
    const personLocation = (person.birthPlace || '').toLowerCase();
    const matchLocation = (potentialMatch.location || '').toLowerCase();

    if (!personLocation || !matchLocation) return 0.4; // Neutral score

    // Exact match
    if (personLocation === matchLocation) return 1.0;

    // Parse location components
    const personParts = personLocation.split(',').map(p => p.trim());
    const matchParts = matchLocation.split(',').map(p => p.trim());

    let score = 0;
    let maxParts = Math.max(personParts.length, matchParts.length);

    // Compare each component
    for (let i = 0; i < maxParts; i++) {
      const personPart = personParts[i] || '';
      const matchPart = matchParts[i] || '';

      if (personPart && matchPart) {
        if (personPart === matchPart) {
          score += 1.0 / maxParts;
        } else if (this.isLocationVariant(personPart, matchPart)) {
          score += 0.8 / maxParts;
        } else if (personPart.includes(matchPart) || matchPart.includes(personPart)) {
          score += 0.6 / maxParts;
        }
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Score family context matching
   */
  scoreFamilyContext(person, potentialMatch) {
    let score = 0.5; // Base score
    let factors = 0;

    // Check parent information
    if (person.parents?.father && potentialMatch.fatherName) {
      const fatherMatch = this.namePartialMatch(
        `${person.parents.father.givenNames} ${person.parents.father.familyNames}`,
        potentialMatch.fatherName
      );
      score += fatherMatch * 0.3;
      factors += 0.3;
    }

    if (person.parents?.mother && potentialMatch.motherName) {
      const motherMatch = this.namePartialMatch(
        `${person.parents.mother.givenNames} ${person.parents.mother.familyNames}`,
        potentialMatch.motherName
      );
      score += motherMatch * 0.3;
      factors += 0.3;
    }

    // Check spouse information
    if (person.spouses?.[0] && potentialMatch.spouseName) {
      const spouseMatch = this.namePartialMatch(
        `${person.spouses[0].givenNames} ${person.spouses[0].familyNames}`,
        potentialMatch.spouseName
      );
      score += spouseMatch * 0.4;
      factors += 0.4;
    }

    // Normalize by number of factors checked
    return factors > 0 ? Math.min(score, 1.0) : 0.5;
  }

  /**
   * Score record quality based on source and completeness
   */
  scoreRecordQuality(potentialMatch) {
    let score = 0.5; // Base score

    // Source reliability
    const sourceScores = {
      'FamilySearch': 0.9,
      'Ancestry': 0.85,
      'FindAGrave': 0.8,
      'Census': 0.9,
      'Vital Records': 0.95,
      'Newspaper Archives': 0.7,
      'Family Trees': 0.6
    };

    score = sourceScores[potentialMatch.source] || 0.5;

    // Completeness bonus
    const hasDate = potentialMatch.birth && potentialMatch.birth !== 'Unknown';
    const hasLocation = potentialMatch.location && potentialMatch.location !== 'Unknown';
    const hasAdditionalInfo = potentialMatch.additionalInfo && potentialMatch.additionalInfo.length > 0;

    if (hasDate) score += 0.1;
    if (hasLocation) score += 0.1;
    if (hasAdditionalInfo) score += 0.05;

    return Math.min(score, 1.0);
  }

  /**
   * Generate human-readable analysis
   */
  generateAnalysis(scores, overallConfidence, person, potentialMatch) {
    const analysis = [];

    // Name analysis
    if (scores.nameMatch > 0.9) {
      analysis.push('✅ Excellent name match');
    } else if (scores.nameMatch > 0.7) {
      analysis.push('✅ Good name similarity');
    } else if (scores.nameMatch > 0.5) {
      analysis.push('⚠️ Moderate name similarity');
    } else {
      analysis.push('❌ Poor name match');
    }

    // Date analysis
    if (scores.dateMatch > 0.9) {
      analysis.push('✅ Excellent date match');
    } else if (scores.dateMatch > 0.7) {
      analysis.push('✅ Good date proximity');
    } else if (scores.dateMatch > 0.4) {
      analysis.push('⚠️ Moderate date difference');
    } else {
      analysis.push('❌ Significant date discrepancy');
    }

    // Location analysis
    if (scores.locationMatch > 0.8) {
      analysis.push('✅ Strong location match');
    } else if (scores.locationMatch > 0.6) {
      analysis.push('✅ Good location similarity');
    } else if (scores.locationMatch > 0.4) {
      analysis.push('⚠️ Some location overlap');
    } else {
      analysis.push('❌ Different locations');
    }

    // Overall assessment
    if (overallConfidence > this.thresholds.autoAccept) {
      analysis.push('🎯 HIGH CONFIDENCE: Likely the same person');
    } else if (overallConfidence > this.thresholds.needsReview) {
      analysis.push('🤔 MODERATE CONFIDENCE: Needs human review');
    } else {
      analysis.push('❌ LOW CONFIDENCE: Probably different person');
    }

    return analysis;
  }

  /**
   * Get recommendation based on confidence score
   */
  getRecommendation(confidence) {
    if (confidence >= this.thresholds.autoAccept) {
      return {
        action: 'accept',
        label: 'Auto-Accept',
        color: 'green',
        description: 'High confidence match - safe to attach automatically'
      };
    } else if (confidence >= this.thresholds.needsReview) {
      return {
        action: 'review',
        label: 'Needs Review',
        color: 'orange',
        description: 'Moderate confidence - human review recommended'
      };
    } else {
      return {
        action: 'reject',
        label: 'Likely Not Match',
        color: 'red',
        description: 'Low confidence - probably not the same person'
      };
    }
  }

  /**
   * Identify specific matching factors
   */
  getMatchingFactors(scores) {
    const factors = [];
    
    if (scores.nameMatch > 0.7) factors.push('Name similarity');
    if (scores.dateMatch > 0.8) factors.push('Birth date match');
    if (scores.locationMatch > 0.7) factors.push('Location match');
    if (scores.familyContext > 0.7) factors.push('Family context');
    if (scores.recordQuality > 0.8) factors.push('High quality source');
    
    return factors;
  }

  /**
   * Identify potential concerns
   */
  identifyConcerns(scores, person, potentialMatch) {
    const concerns = [];
    
    if (scores.nameMatch < 0.5) concerns.push('Name differs significantly');
    if (scores.dateMatch < 0.4) concerns.push('Birth dates differ substantially');
    if (scores.locationMatch < 0.4) concerns.push('Different birth locations');
    if (scores.recordQuality < 0.6) concerns.push('Lower quality source');
    
    return concerns;
  }

  // Helper methods for similarity calculations
  
  levenshteinSimilarity(str1, str2) {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
    
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

  jaroSimilarity(str1, str2) {
    // Simplified Jaro similarity implementation
    if (str1 === str2) return 1.0;
    
    const len1 = str1.length;
    const len2 = str2.length;
    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    
    if (matchWindow < 0) return 0.0;
    
    const matches1 = new Array(len1).fill(false);
    const matches2 = new Array(len2).fill(false);
    let matches = 0;
    let transpositions = 0;
    
    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);
      
      for (let j = start; j < end; j++) {
        if (matches2[j] || str1[i] !== str2[j]) continue;
        matches1[i] = matches2[j] = true;
        matches++;
        break;
      }
    }
    
    if (matches === 0) return 0.0;
    
    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!matches1[i]) continue;
      while (!matches2[k]) k++;
      if (str1[i] !== str2[k]) transpositions++;
      k++;
    }
    
    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3.0;
  }

  soundexMatch(str1, str2) {
    return this.soundex(str1) === this.soundex(str2);
  }

  soundex(str) {
    const code = str.toUpperCase().replace(/[^A-Z]/g, '');
    if (!code) return '0000';
    
    let soundexCode = code[0];
    const mapping = { 'BFPV': '1', 'CGJKQSXZ': '2', 'DT': '3', 'L': '4', 'MN': '5', 'R': '6' };
    
    for (let i = 1; i < code.length && soundexCode.length < 4; i++) {
      const char = code[i];
      for (const [letters, digit] of Object.entries(mapping)) {
        if (letters.includes(char) && soundexCode[soundexCode.length - 1] !== digit) {
          soundexCode += digit;
          break;
        }
      }
    }
    
    return soundexCode.padEnd(4, '0');
  }

  nicknameMatch(givenName, fullName) {
    if (!givenName || !fullName) return 0;
    
    const nicknames = {
      'Stephen': ['Steve', 'Steven', 'Stephan'],
      'William': ['Bill', 'Will', 'Billy', 'Willie'],
      'Robert': ['Bob', 'Rob', 'Bobby', 'Robbie'],
      'James': ['Jim', 'Jimmy', 'Jamie'],
      'Michael': ['Mike', 'Mickey', 'Mick']
    };
    
    const possibleNicknames = nicknames[givenName] || [];
    return possibleNicknames.some(nick => fullName.toLowerCase().includes(nick.toLowerCase())) ? 0.9 : 0;
  }

  initialMatch(name1, name2) {
    const initials1 = name1.split(' ').map(w => w[0]).join('').toLowerCase();
    const initials2 = name2.split(' ').map(w => w[0]).join('').toLowerCase();
    return initials1 === initials2 ? 0.6 : 0;
  }

  namePartialMatch(name1, name2) {
    if (!name1 || !name2) return 0;
    return this.levenshteinSimilarity(name1.toLowerCase(), name2.toLowerCase());
  }

  isLocationVariant(loc1, loc2) {
    const variants = {
      'ontario': ['ont', 'on'],
      'canada': ['can', 'ca'],
      'united states': ['usa', 'us', 'america'],
      'pennsylvania': ['pa', 'penn']
    };
    
    const l1 = loc1.toLowerCase();
    const l2 = loc2.toLowerCase();
    
    for (const [full, abbrs] of Object.entries(variants)) {
      if ((l1 === full && abbrs.includes(l2)) || (l2 === full && abbrs.includes(l1))) {
        return true;
      }
    }
    
    return false;
  }

  extractYear(dateString) {
    if (!dateString) return null;
    const yearMatch = dateString.match(/\b(18|19|20)\d{2}\b/);
    return yearMatch ? parseInt(yearMatch[0]) : null;
  }
}

module.exports = { ConfidenceScorer };