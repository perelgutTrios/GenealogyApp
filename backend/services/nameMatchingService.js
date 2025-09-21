/**
 * Advanced Name Matching Service for Genealogical Research
 * Handles name variations, nicknames, cultural adaptations, and phonetic matching
 */

class NameMatchingService {
  constructor() {
    // Common nickname mappings
    this.nicknameMap = this.buildNicknameMap();
    
    // Cultural name variations (immigrants often Americanized names)
    this.culturalVariations = this.buildCulturalVariations();
    
    // Common spelling variations
    this.spellingVariations = this.buildSpellingVariations();
    
    // Maiden name indicators
    this.maidenNameIndicators = [
      'nee', 'née', 'born', 'formerly', 'maiden name', 'maiden', 'née'
    ];
  }

  /**
   * Main name matching function
   * Returns a confidence score between 0 and 1
   */
  matchNames(name1, name2, options = {}) {
    const {
      usePhoneticMatching = false,
      strictMode = false,
      allowNicknames = true,
      allowCultural = true,
      allowSpellingVariations = true
    } = options;

    if (!name1 || !name2) return 0;

    // Normalize names
    const normalized1 = this.normalizeName(name1);
    const normalized2 = this.normalizeName(name2);

    // Exact match after normalization
    if (normalized1 === normalized2) return 1.0;

    let maxScore = 0;
    const scores = [];

    // Direct similarity
    scores.push(this.calculateDirectSimilarity(normalized1, normalized2));

    if (!strictMode) {
      // Check nickname variations
      if (allowNicknames) {
        scores.push(this.checkNicknameMatch(normalized1, normalized2));
      }

      // Check cultural variations
      if (allowCultural) {
        scores.push(this.checkCulturalVariations(normalized1, normalized2));
      }

      // Check spelling variations
      if (allowSpellingVariations) {
        scores.push(this.checkSpellingVariations(normalized1, normalized2));
      }

      // Phonetic matching (optional)
      if (usePhoneticMatching) {
        scores.push(this.checkPhoneticMatch(normalized1, normalized2));
      }
    }

    // Return the highest confidence score
    return Math.max(...scores);
  }

  /**
   * Match full names (given + family names)
   */
  matchFullNames(person1, person2, options = {}) {
    const givenScore = this.matchNames(
      person1.givenNames || person1.givenName || '',
      person2.givenNames || person2.givenName || '',
      options
    );

    const familyScore = this.matchNames(
      person1.familyNames || person1.familyName || person1.surname || '',
      person2.familyNames || person2.familyName || person2.surname || '',
      options
    );

    // Handle maiden names
    const maidenScore = this.checkMaidenNameMatch(person1, person2, options);

    // Weight given names slightly higher than family names
    const weightedScore = (givenScore * 0.6) + (Math.max(familyScore, maidenScore) * 0.4);
    
    return {
      overallScore: weightedScore,
      givenNameScore: givenScore,
      familyNameScore: familyScore,
      maidenNameScore: maidenScore,
      details: {
        givenMatch: givenScore > 0.7,
        familyMatch: Math.max(familyScore, maidenScore) > 0.7,
        strongMatch: weightedScore > 0.8
      }
    };
  }

  /**
   * Normalize name for comparison
   */
  normalizeName(name) {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      // Remove common prefixes and suffixes
      .replace(/^(mr|mrs|ms|dr|prof|rev|sir|lady)\.?\s+/i, '')
      .replace(/\s+(jr|sr|ii|iii|iv|esq)\.?$/i, '')
      // Remove punctuation except hyphens and apostrophes
      .replace(/[^\w\s\-']/g, '')
      // Normalize multiple spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate direct string similarity using Levenshtein distance
   */
  calculateDirectSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0;

    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return Math.max(0, 1 - (distance / maxLength));
  }

  /**
   * Check for nickname matches
   */
  checkNicknameMatch(name1, name2) {
    const nicknames1 = this.getNicknameVariations(name1);
    const nicknames2 = this.getNicknameVariations(name2);

    let maxScore = 0;
    
    for (const nick1 of nicknames1) {
      for (const nick2 of nicknames2) {
        const score = this.calculateDirectSimilarity(nick1, nick2);
        maxScore = Math.max(maxScore, score);
      }
    }

    return maxScore;
  }

  /**
   * Check for cultural name variations
   */
  checkCulturalVariations(name1, name2) {
    const variations1 = this.getCulturalVariations(name1);
    const variations2 = this.getCulturalVariations(name2);

    let maxScore = 0;
    
    for (const var1 of variations1) {
      for (const var2 of variations2) {
        const score = this.calculateDirectSimilarity(var1, var2);
        maxScore = Math.max(maxScore, score);
      }
    }

    return maxScore;
  }

  /**
   * Check for spelling variations
   */
  checkSpellingVariations(name1, name2) {
    const variations1 = this.getSpellingVariations(name1);
    const variations2 = this.getSpellingVariations(name2);

    let maxScore = 0;
    
    for (const var1 of variations1) {
      for (const var2 of variations2) {
        const score = this.calculateDirectSimilarity(var1, var2);
        maxScore = Math.max(maxScore, score);
      }
    }

    return maxScore;
  }

  /**
   * Check for phonetic matches using Soundex algorithm
   */
  checkPhoneticMatch(name1, name2) {
    const soundex1 = this.soundex(name1);
    const soundex2 = this.soundex(name2);
    
    // Exact phonetic match
    if (soundex1 === soundex2) return 0.85;
    
    // Similar phonetic codes (first 3 characters match)
    if (soundex1.substring(0, 3) === soundex2.substring(0, 3)) return 0.7;
    
    return 0;
  }

  /**
   * Check for maiden name matches
   */
  checkMaidenNameMatch(person1, person2, options) {
    // Extract potential maiden names
    const maiden1 = this.extractMaidenName(person1);
    const maiden2 = this.extractMaidenName(person2);
    
    if (!maiden1 && !maiden2) return 0;
    
    // Check if maiden name matches other person's family name
    let maxScore = 0;
    
    if (maiden1) {
      maxScore = Math.max(maxScore, this.matchNames(maiden1, person2.familyNames || '', options));
    }
    
    if (maiden2) {
      maxScore = Math.max(maxScore, this.matchNames(maiden2, person1.familyNames || '', options));
    }
    
    return maxScore;
  }

  /**
   * Get all nickname variations for a given name
   */
  getNicknameVariations(name) {
    const variations = new Set([name]);
    const words = name.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      // Add the word itself (original case)
      const originalWord = name.split(/\s+/).find(w => w.toLowerCase() === word) || word;
      variations.add(originalWord);
      
      // Check if this word has known nicknames (lowercase lookup)
      if (this.nicknameMap.has(word)) {
        this.nicknameMap.get(word).forEach(nick => {
          // Capitalize first letter to match input style
          const capitalizedNick = nick.charAt(0).toUpperCase() + nick.slice(1);
          variations.add(capitalizedNick);
        });
      }
      
      // Check if this word IS a nickname for something else
      for (const [formal, nicks] of this.nicknameMap.entries()) {
        if (nicks.includes(word)) {
          // Add the formal name (capitalized)
          const capitalizedFormal = formal.charAt(0).toUpperCase() + formal.slice(1);
          variations.add(capitalizedFormal);
          // Add other nicknames for the same formal name
          nicks.forEach(nick => {
            const capitalizedNick = nick.charAt(0).toUpperCase() + nick.slice(1);
            variations.add(capitalizedNick);
          });
        }
      }
    }
    
    return Array.from(variations);
  }

  /**
   * Get cultural variations for a name
   */
  getCulturalVariations(name) {
    const variations = new Set([name]);
    const words = name.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      // Add original word with proper capitalization
      const originalWord = name.split(/\s+/).find(w => w.toLowerCase() === word) || word;
      variations.add(originalWord);
      
      if (this.culturalVariations.has(word)) {
        this.culturalVariations.get(word).forEach(var_name => {
          const capitalized = var_name.charAt(0).toUpperCase() + var_name.slice(1);
          variations.add(capitalized);
        });
      }
      
      // Reverse lookup
      for (const [original, variants] of this.culturalVariations.entries()) {
        if (variants.includes(word)) {
          const capitalizedOriginal = original.charAt(0).toUpperCase() + original.slice(1);
          variations.add(capitalizedOriginal);
          variants.forEach(variant => {
            const capitalizedVariant = variant.charAt(0).toUpperCase() + variant.slice(1);
            variations.add(capitalizedVariant);
          });
        }
      }
    }
    
    return Array.from(variations);
  }

  /**
   * Get spelling variations for a name
   */
  getSpellingVariations(name) {
    const variations = new Set([name]);
    const lowerName = name.toLowerCase();
    
    // Add variations from spelling map
    if (this.spellingVariations.has(lowerName)) {
      this.spellingVariations.get(lowerName).forEach(var_name => {
        const capitalized = var_name.charAt(0).toUpperCase() + var_name.slice(1);
        variations.add(capitalized);
      });
    }
    
    // Generate common phonetic-based variations
    const phoneticVars = this.generatePhoneticVariations(name);
    phoneticVars.forEach(variant => variations.add(variant));
    
    return Array.from(variations).filter(v => v.trim().length > 0);
  }

  /**
   * Extract maiden name from person data
   */
  extractMaidenName(person) {
    // Check for explicit maiden name fields
    if (person.maidenName) return person.maidenName;
    if (person.birthName) return person.birthName;
    
    // Look for maiden name indicators in family names
    const familyName = person.familyNames || person.familyName || '';
    
    for (const indicator of this.maidenNameIndicators) {
      const pattern = new RegExp(`\\b${indicator}\\s+([\\w\\s-']+)`, 'i');
      const match = familyName.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    // Look for parenthetical maiden names: "Smith (Jones)"
    const parenthetical = familyName.match(/\(([^)]+)\)/);
    if (parenthetical) {
      return parenthetical[1].trim();
    }
    
    return null;
  }

  /**
   * Generate common phonetic variations
   */
  generatePhoneticVariations(name) {
    const variations = [];
    
    // Common letter substitutions
    const substitutions = [
      ['ph', 'f'], ['c', 'k'], ['ck', 'k'], ['qu', 'kw'],
      ['x', 'ks'], ['z', 's'], ['th', 't'], ['gh', 'g']
    ];
    
    let variant = name;
    for (const [from, to] of substitutions) {
      if (variant.includes(from)) {
        variations.push(variant.replace(new RegExp(from, 'g'), to));
      }
    }
    
    return variations;
  }

  /**
   * Levenshtein distance calculation
   */
  levenshteinDistance(str1, str2) {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Soundex algorithm implementation
   */
  soundex(name) {
    if (!name) return '';
    
    let soundex = name.charAt(0).toUpperCase();
    
    const mapping = {
      'B': '1', 'F': '1', 'P': '1', 'V': '1',
      'C': '2', 'G': '2', 'J': '2', 'K': '2', 'Q': '2', 'S': '2', 'X': '2', 'Z': '2',
      'D': '3', 'T': '3',
      'L': '4',
      'M': '5', 'N': '5',
      'R': '6'
    };
    
    for (let i = 1; i < name.length && soundex.length < 4; i++) {
      const char = name.charAt(i).toUpperCase();
      const code = mapping[char];
      
      if (code && code !== soundex.slice(-1)) {
        soundex += code;
      }
    }
    
    return soundex.padEnd(4, '0').substring(0, 4);
  }

  /**
   * Build nickname mapping
   */
  buildNicknameMap() {
    const map = new Map();
    
    // Male names
    map.set('alexander', ['alex', 'al', 'sandy', 'xander']);
    map.set('andrew', ['andy', 'drew', 'andre']);
    map.set('anthony', ['tony', 'ant', 'antonio']);
    map.set('benjamin', ['ben', 'benny', 'benji']);
    map.set('charles', ['charlie', 'chuck', 'chas']);
    map.set('christopher', ['chris', 'kit', 'topher']);
    map.set('daniel', ['dan', 'danny', 'dane']);
    map.set('david', ['dave', 'davey', 'davy']);
    map.set('edward', ['ed', 'eddie', 'ted', 'teddy']);
    map.set('frederick', ['fred', 'freddy', 'fritz']);
    map.set('gregory', ['greg', 'gregg']);
    map.set('henry', ['harry', 'hank', 'hal']);
    map.set('james', ['jim', 'jimmy', 'jamie', 'jack']);
    map.set('john', ['jack', 'johnny', 'jon']);
    map.set('joseph', ['joe', 'joey', 'jose']);
    map.set('joshua', ['josh']);
    map.set('lawrence', ['larry', 'laurie']);
    map.set('matthew', ['matt', 'matty']);
    map.set('michael', ['mike', 'mickey', 'mick']);
    map.set('nicholas', ['nick', 'nicky', 'cole']);
    map.set('patrick', ['pat', 'paddy', 'rick']);
    map.set('peter', ['pete', 'petey']);
    map.set('richard', ['rick', 'ricky', 'dick', 'rich']);
    map.set('robert', ['bob', 'bobby', 'rob', 'robby', 'bert']);
    map.set('ronald', ['ron', 'ronny', 'ronnie']);
    map.set('stephen', ['steve', 'stevie', 'stefan']);
    map.set('steven', ['steve', 'stevie']);
    map.set('thomas', ['tom', 'tommy', 'thom']);
    map.set('timothy', ['tim', 'timmy']);
    map.set('william', ['bill', 'billy', 'will', 'willy', 'willie', 'liam']);
    
    // Female names
    map.set('alexandra', ['alex', 'sandy', 'alexa']);
    map.set('catherine', ['kate', 'katie', 'cathy', 'catherine', 'kitty']);
    map.set('christina', ['chris', 'christie', 'tina']);
    map.set('deborah', ['debbie', 'deb', 'debra']);
    map.set('elizabeth', ['liz', 'beth', 'betty', 'betsy', 'eliza', 'libby']);
    map.set('jennifer', ['jen', 'jenny', 'jenn']);
    map.set('jessica', ['jess', 'jessie']);
    map.set('katherine', ['kate', 'katie', 'kathy', 'kitty']);
    map.set('kimberly', ['kim', 'kimmy']);
    map.set('margaret', ['maggie', 'meg', 'peggy', 'margie']);
    map.set('patricia', ['pat', 'patty', 'tricia']);
    map.set('rebecca', ['becky', 'becca', 'beck']);
    map.set('stephanie', ['steph', 'stefanie']);
    map.set('susan', ['sue', 'susie', 'suzy']);
    map.set('victoria', ['vicky', 'vikki', 'tori']);
    
    return map;
  }

  /**
   * Build cultural variations mapping
   */
  buildCulturalVariations() {
    const map = new Map();
    
    // Polish to American
    map.set('stanislaw', ['stanley', 'stan']);
    map.set('wladyslaw', ['walter', 'walt']);
    map.set('kazimierz', ['casimir', 'casey']);
    map.set('wojciech', ['albert', 'wojtek']);
    map.set('jan', ['john', 'johnny']);
    
    // German to American
    map.set('johann', ['john', 'johnny']);
    map.set('wilhelm', ['william', 'bill', 'will']);
    map.set('friedrich', ['frederick', 'fred']);
    map.set('heinrich', ['henry', 'harry']);
    
    // Italian to American
    map.set('giuseppe', ['joseph', 'joe']);
    map.set('giovanni', ['john', 'johnny']);
    map.set('antonio', ['anthony', 'tony']);
    map.set('francesco', ['francis', 'frank']);
    
    // Irish to American
    map.set('padraig', ['patrick', 'pat']);
    map.set('sean', ['john', 'johnny']);
    map.set('siobhan', ['joan', 'joanne']);
    
    // Jewish/Hebrew variations
    map.set('moshe', ['moses', 'morris', 'moe']);
    map.set('abraham', ['abraham', 'abe', 'abram']);
    map.set('isaac', ['isaac', 'ike']);
    map.set('jacob', ['jacob', 'jake', 'jack']);
    
    return map;
  }

  /**
   * Build spelling variations mapping
   */
  buildSpellingVariations() {
    const map = new Map();
    
    // Common surname variations
    map.set('smith', ['smyth', 'smythe']);
    map.set('johnson', ['johnsen', 'johnston', 'jonson']);
    map.set('brown', ['browne']);
    map.set('davis', ['davies', 'davys']);
    map.set('miller', ['muller', 'mueller']);
    map.set('wilson', ['willson']);
    map.set('moore', ['more', 'mohr']);
    map.set('taylor', ['tailor', 'tayler']);
    map.set('anderson', ['andersen']);
    map.set('jackson', ['jakson']);
    
    // Eastern European variations
    map.set('kowalski', ['kowalsky', 'kowalczyk']);
    map.set('nowak', ['nowack', 'novak']);
    map.set('wojcik', ['wojczik', 'woycik']);
    
    return map;
  }
}

module.exports = { NameMatchingService };