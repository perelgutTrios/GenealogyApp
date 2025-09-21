/**
 * Smart Data Validation Service for Genealogical Records
 * Provides comprehensive data quality checks and relationship validation
 */

class GenealogyValidationService {
  constructor() {
    // Historical constraints
    this.MIN_PARENT_AGE = 12; // Minimum biological age for parenthood
    this.MAX_PARENT_AGE = 60; // Maximum reasonable age for parenthood (can be overridden)
    this.MIN_MARRIAGE_AGE = 12; // Historical minimum (varies by culture/era)
    this.MAX_HUMAN_LIFESPAN = 122; // Verified maximum human lifespan
    this.REASONABLE_LIFESPAN = 100; // Reasonable maximum for most eras
    
    // Historical context data
    this.historicalEvents = this.buildHistoricalContext();
    this.locationHistory = this.buildLocationHistory();
    
    // Source reliability rankings
    this.sourceReliability = this.buildSourceReliability();
  }

  /**
   * Normalize person names - convert single 'name' field to givenNames/familyNames
   */
  normalizePersonNames(person) {
    // Create a copy to avoid mutating the original
    const normalized = { ...person };
    
    // If we have a 'name' field but no givenNames/familyNames, parse it
    if (normalized.name && (!normalized.givenNames && !normalized.familyNames)) {
      const nameParts = normalized.name.trim().split(/\s+/);
      if (nameParts.length > 0) {
        normalized.givenNames = nameParts.slice(0, -1).join(' ') || nameParts[0];
        normalized.familyNames = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
      }
    }
    
    return normalized;
  }

  /**
   * Normalize family context - ensure all family members have proper name fields
   */
  normalizeFamilyContext(familyContext) {
    const normalized = {};
    
    for (const [relation, person] of Object.entries(familyContext)) {
      if (person) {
        normalized[relation] = this.normalizePersonNames(person);
      }
    }
    
    return normalized;
  }

  /**
   * Main validation function - validates a person record with family context
   */
  validatePersonRecord(person, familyContext = {}) {
    const validationResults = {
      isValid: true,
      confidence: 1.0,
      issues: [],
      warnings: [],
      recommendations: [],
      validationScore: 1.0,
      validatedAt: new Date()
    };

    try {
      // Normalize name fields if needed
      person = this.normalizePersonNames(person);
      familyContext = this.normalizeFamilyContext(familyContext);
      
      // Core data validation
      this.validateCoreData(person, validationResults);
      
      // Relationship validation
      this.validateRelationships(person, familyContext, validationResults);
      
      // Timeline consistency
      this.validateTimeline(person, familyContext, validationResults);
      
      // Historical context validation
      this.validateHistoricalContext(person, validationResults);
      
      // Data quality assessment
      this.assessDataQuality(person, validationResults);
      
      // Calculate final scores
      this.calculateFinalScores(validationResults);
      
    } catch (error) {
      validationResults.issues.push({
        type: 'validation_error',
        severity: 'error',
        message: `Validation failed: ${error.message}`,
        field: 'general'
      });
      validationResults.isValid = false;
      validationResults.confidence = 0.1;
    }

    return validationResults;
  }

  /**
   * Validate core person data (dates, names, basic info)
   */
  validateCoreData(person, results) {
    // Birth date validation
    if (person.birthDate) {
      const birthValidation = this.validateDate(person.birthDate, 'birth');
      if (!birthValidation.isValid) {
        results.issues.push({
          type: 'invalid_birth_date',
          severity: 'error',
          message: birthValidation.reason,
          field: 'birthDate',
          value: person.birthDate
        });
      }
    }

    // Death date validation
    if (person.deathDate) {
      const deathValidation = this.validateDate(person.deathDate, 'death');
      if (!deathValidation.isValid) {
        results.issues.push({
          type: 'invalid_death_date',
          severity: 'error',
          message: deathValidation.reason,
          field: 'deathDate',
          value: person.deathDate
        });
      }
      
      // Birth-death consistency
      if (person.birthDate) {
        const lifespanValidation = this.validateLifespan(person.birthDate, person.deathDate);
        if (!lifespanValidation.isValid) {
          results.issues.push({
            type: 'invalid_lifespan',
            severity: lifespanValidation.severity,
            message: lifespanValidation.reason,
            field: 'lifespan',
            calculatedAge: lifespanValidation.age
          });
        }
      }
    }

    // Name validation
    if (!person.givenNames && !person.familyNames) {
      results.issues.push({
        type: 'missing_name',
        severity: 'error',
        message: 'Person must have at least given name or family name',
        field: 'name'
      });
    }

    // Sex validation
    if (person.sex && !['M', 'F', 'U'].includes(person.sex)) {
      results.warnings.push({
        type: 'invalid_sex',
        severity: 'warning',
        message: `Invalid sex value: ${person.sex}. Expected M, F, or U`,
        field: 'sex',
        value: person.sex
      });
    }
  }

  /**
   * Validate family relationships
   */
  validateRelationships(person, familyContext, results) {
    // Handle both nested and flat family context structures
    
    // Parent-child age validation
    let parents = familyContext.parents;
    if (!parents && (familyContext.father || familyContext.mother)) {
      // Create parents structure from flat father/mother
      parents = {
        father: familyContext.father,
        mother: familyContext.mother
      };
    }
    if (parents) {
      this.validateParentChildAges(person, parents, results);
    }

    // Spouse age validation  
    let spouses = familyContext.spouses;
    if (!spouses && familyContext.spouse) {
      // Handle single spouse as array
      spouses = [familyContext.spouse];
    }
    if (spouses) {
      this.validateSpouseAges(person, spouses, results);
    }

    // Children validation
    if (familyContext.children) {
      this.validateChildrenAges(person, familyContext.children, results);
    }

    // Sibling validation
    if (familyContext.siblings) {
      this.validateSiblingAges(person, familyContext.siblings, results);
    }
  }

  /**
   * Validate parent-child age relationships
   */
  validateParentChildAges(person, parents, results) {
    const personBirthYear = this.extractYear(person.birthDate);
    if (!personBirthYear) return;

    ['father', 'mother'].forEach(parentType => {
      const parent = parents[parentType];
      if (!parent || !parent.birthDate) return;

      const parentBirthYear = this.extractYear(parent.birthDate);
      if (!parentBirthYear) return;

      const parentAgeAtBirth = personBirthYear - parentBirthYear;

      // Too young to be parent
      if (parentAgeAtBirth < this.MIN_PARENT_AGE) {
        results.issues.push({
          type: 'parent_too_young',
          severity: 'error',
          message: `${parentType} would be ${parentAgeAtBirth} years old at child's birth (minimum: ${this.MIN_PARENT_AGE})`,
          field: `${parentType}Age`,
          parentName: `${parent.givenNames} ${parent.familyNames}`,
          calculatedAge: parentAgeAtBirth
        });
      }

      // Unusually old to be parent (warning, not error)
      if (parentAgeAtBirth > this.MAX_PARENT_AGE) {
        results.warnings.push({
          type: 'parent_very_old',
          severity: 'warning',
          message: `${parentType} would be ${parentAgeAtBirth} years old at child's birth (unusual for the era)`,
          field: `${parentType}Age`,
          parentName: `${parent.givenNames} ${parent.familyNames}`,
          calculatedAge: parentAgeAtBirth
        });
      }
    });
  }

  /**
   * Validate spouse age differences and marriage ages
   */
  validateSpouseAges(person, spouses, results) {
    const personBirthYear = this.extractYear(person.birthDate);
    if (!personBirthYear) return;

    spouses.forEach((spouse, index) => {
      if (!spouse.birthDate) return;
      
      const spouseBirthYear = this.extractYear(spouse.birthDate);
      if (!spouseBirthYear) return;

      const ageDifference = Math.abs(personBirthYear - spouseBirthYear);
      
      // Unusual age gap (warning)
      if (ageDifference > 25) {
        results.warnings.push({
          type: 'large_spouse_age_gap',
          severity: 'warning',
          message: `Large age difference with spouse: ${ageDifference} years`,
          field: 'spouseAge',
          spouseName: `${spouse.givenNames} ${spouse.familyNames}`,
          ageDifference: ageDifference
        });
      }

      // Marriage age validation
      if (spouse.marriageDate) {
        const marriageYear = this.extractYear(spouse.marriageDate);
        if (marriageYear) {
          const personMarriageAge = marriageYear - personBirthYear;
          const spouseMarriageAge = marriageYear - spouseBirthYear;

          if (personMarriageAge < this.MIN_MARRIAGE_AGE) {
            results.issues.push({
              type: 'marriage_too_young',
              severity: 'error',
              message: `Person married at age ${personMarriageAge} (minimum: ${this.MIN_MARRIAGE_AGE})`,
              field: 'marriageAge',
              calculatedAge: personMarriageAge
            });
          }

          if (spouseMarriageAge < this.MIN_MARRIAGE_AGE) {
            results.issues.push({
              type: 'spouse_marriage_too_young',
              severity: 'error',
              message: `Spouse married at age ${spouseMarriageAge} (minimum: ${this.MIN_MARRIAGE_AGE})`,
              field: 'spouseMarriageAge',
              spouseName: `${spouse.givenNames} ${spouse.familyNames}`,
              calculatedAge: spouseMarriageAge
            });
          }
        }
      }
    });
  }

  /**
   * Validate timeline consistency across events
   */
  validateTimeline(person, familyContext, results) {
    const events = this.extractTimelineEvents(person, familyContext);
    
    // Sort events chronologically
    events.sort((a, b) => {
      const yearA = this.extractYear(a.date);
      const yearB = this.extractYear(b.date);
      return (yearA || 0) - (yearB || 0);
    });

    // Check for chronological inconsistencies
    for (let i = 0; i < events.length - 1; i++) {
      const currentEvent = events[i];
      const nextEvent = events[i + 1];
      
      const currentYear = this.extractYear(currentEvent.date);
      const nextYear = this.extractYear(nextEvent.date);
      
      if (currentYear && nextYear && currentYear > nextYear) {
        results.issues.push({
          type: 'chronology_error',
          severity: 'error',
          message: `${currentEvent.type} (${currentYear}) occurs after ${nextEvent.type} (${nextYear})`,
          field: 'timeline',
          events: [currentEvent, nextEvent]
        });
      }
    }

    // Parent death before child birth validation
    if (person.birthDate) {
      const birthYear = this.extractYear(person.birthDate);
      
      // Check if parents died before person was born
      const parents = familyContext.parents || { 
        father: familyContext.father, 
        mother: familyContext.mother 
      };
      
      ['father', 'mother'].forEach(parentType => {
        const parent = parents[parentType];
        if (parent && parent.deathDate && birthYear) {
          const parentDeathYear = this.extractYear(parent.deathDate);
          
          if (parentDeathYear && parentDeathYear < birthYear) {
            results.issues.push({
              type: 'parent_died_before_birth',
              severity: 'error',
              message: `${parentType} died in ${parentDeathYear}, but child was born in ${birthYear}`,
              field: 'timeline',
              parentName: `${parent.givenNames || ''} ${parent.familyNames || ''}`.trim() || parent.name
            });
          }
        }
      });
    }

    // Birth before marriage validation
    const spouses = familyContext.spouses || (familyContext.spouse ? [familyContext.spouse] : []);
    if (person.birthDate && spouses.length > 0) {
      spouses.forEach(spouse => {
        if (spouse.marriageDate) {
          const birthYear = this.extractYear(person.birthDate);
          const marriageYear = this.extractYear(spouse.marriageDate);
          
          if (birthYear && marriageYear && marriageYear < birthYear) {
            results.issues.push({
              type: 'marriage_before_birth',
              severity: 'error',
              message: `Marriage (${marriageYear}) occurs before birth (${birthYear})`,
              field: 'timeline'
            });
          }
        }
      });
    }
  }

  /**
   * Validate historical context
   */
  validateHistoricalContext(person, results) {
    // Location-time consistency
    if (person.birthPlace && person.birthDate) {
      const birthYear = this.extractYear(person.birthDate);
      const locationValidation = this.validateLocationHistory(person.birthPlace, birthYear);
      
      if (!locationValidation.isValid) {
        results.warnings.push({
          type: 'anachronistic_location',
          severity: 'warning',
          message: locationValidation.reason,
          field: 'birthPlace',
          location: person.birthPlace,
          year: birthYear
        });
      }
    }

    // Historical event context
    if (person.birthDate) {
      const contextualEvents = this.findHistoricalContext(person.birthDate);
      if (contextualEvents.length > 0) {
        results.recommendations.push({
          type: 'historical_context',
          message: `Consider historical events: ${contextualEvents.join(', ')}`,
          field: 'context',
          events: contextualEvents
        });
      }
    }
  }

  /**
   * Assess overall data quality
   */
  assessDataQuality(person, results) {
    let qualityScore = 1.0;
    const factors = [];

    // Completeness assessment
    const coreFields = ['givenNames', 'familyNames', 'birthDate', 'birthPlace', 'sex'];
    const completedFields = coreFields.filter(field => person[field]).length;
    const completeness = completedFields / coreFields.length;
    
    qualityScore *= completeness;
    factors.push(`Completeness: ${Math.round(completeness * 100)}%`);

    // Date precision assessment
    if (person.birthDate) {
      const datePrecision = this.assessDatePrecision(person.birthDate);
      qualityScore *= datePrecision.score;
      factors.push(`Date precision: ${datePrecision.level}`);
    }

    // Source reliability (if available)
    if (person.sources && person.sources.length > 0) {
      const sourceScore = this.assessSourceReliability(person.sources);
      qualityScore *= sourceScore.score;
      factors.push(`Source reliability: ${sourceScore.level}`);
    }

    // Record consistency
    if (results.issues.length === 0 && results.warnings.length === 0) {
      factors.push('No validation issues');
    } else {
      const issueScore = Math.max(0.1, 1 - (results.issues.length * 0.2 + results.warnings.length * 0.1));
      qualityScore *= issueScore;
      factors.push(`Issues detected: -${Math.round((1 - issueScore) * 100)}%`);
    }

    results.qualityAssessment = {
      score: qualityScore,
      factors: factors,
      completeness: completeness,
      recommendation: this.getQualityRecommendation(qualityScore)
    };
  }

  /**
   * Calculate final validation scores
   */
  calculateFinalScores(results) {
    // Base validation score
    let validationScore = 1.0;
    
    // Penalize for issues
    results.issues.forEach(issue => {
      switch (issue.severity) {
        case 'error':
          validationScore -= 0.25;
          break;
        case 'warning':
          validationScore -= 0.1;
          break;
      }
    });

    results.warnings.forEach(warning => {
      validationScore -= 0.05;
    });

    // Ensure minimum score
    validationScore = Math.max(0.0, validationScore);
    
    // Overall validity
    results.isValid = results.issues.filter(i => i.severity === 'error').length === 0;
    
    // Confidence is combination of validation score and quality assessment
    const qualityScore = results.qualityAssessment ? results.qualityAssessment.score : 0.5;
    results.confidence = (validationScore * 0.7) + (qualityScore * 0.3);
    
    results.validationScore = validationScore;
  }

  // Helper methods
  
  validateDate(dateString, type) {
    try {
      const year = this.extractYear(dateString);
      if (!year) {
        return { isValid: false, reason: `Invalid ${type} date format: ${dateString}` };
      }
      
      const currentYear = new Date().getFullYear();
      
      // Future date check
      if (year > currentYear) {
        return { isValid: false, reason: `${type} date cannot be in the future: ${year}` };
      }
      
      // Historical plausibility
      if (type === 'birth' && year < 1000) {
        return { isValid: false, reason: `Birth year ${year} is historically implausible` };
      }
      
      return { isValid: true, year: year };
      
    } catch (error) {
      return { isValid: false, reason: `Date parsing error: ${error.message}` };
    }
  }

  validateLifespan(birthDate, deathDate) {
    const birthYear = this.extractYear(birthDate);
    const deathYear = this.extractYear(deathDate);
    
    if (!birthYear || !deathYear) {
      return { isValid: true, reason: 'Unable to calculate age' };
    }
    
    const age = deathYear - birthYear;
    
    if (age < 0) {
      return { 
        isValid: false, 
        severity: 'error',
        reason: `Death year (${deathYear}) before birth year (${birthYear})`,
        age: age 
      };
    }
    
    if (age > this.MAX_HUMAN_LIFESPAN) {
      return { 
        isValid: false, 
        severity: 'error',
        reason: `Age ${age} exceeds maximum human lifespan (${this.MAX_HUMAN_LIFESPAN})`,
        age: age 
      };
    }
    
    if (age > this.REASONABLE_LIFESPAN) {
      return { 
        isValid: true, 
        severity: 'warning',
        reason: `Age ${age} is unusually high but possible`,
        age: age 
      };
    }
    
    return { isValid: true, age: age };
  }

  extractTimelineEvents(person, familyContext) {
    const events = [];
    
    if (person.birthDate) {
      events.push({ type: 'birth', date: person.birthDate, person: 'self' });
    }
    
    if (person.deathDate) {
      events.push({ type: 'death', date: person.deathDate, person: 'self' });
    }
    
    // Handle both nested and flat spouse structure
    const spouses = familyContext.spouses || (familyContext.spouse ? [familyContext.spouse] : []);
    spouses.forEach((spouse, index) => {
      if (spouse.marriageDate) {
        events.push({ type: `marriage_${index + 1}`, date: spouse.marriageDate, person: 'spouse' });
      }
    });
    
    // Add parent events for relationship validation
    const parents = familyContext.parents || { 
      father: familyContext.father, 
      mother: familyContext.mother 
    };
    
    if (parents.father && parents.father.deathDate) {
      events.push({ type: 'father_death', date: parents.father.deathDate, person: 'father' });
    }
    
    if (parents.mother && parents.mother.deathDate) {
      events.push({ type: 'mother_death', date: parents.mother.deathDate, person: 'mother' });
    }
    
    return events;
  }

  extractYear(dateString) {
    if (!dateString) return null;
    const match = dateString.toString().match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    return match ? parseInt(match[0]) : null;
  }

  // Data builders for historical context
  
  buildHistoricalContext() {
    return {
      1914: 'World War I begins',
      1918: 'World War I ends',
      1929: 'Great Depression begins',
      1939: 'World War II begins',
      1945: 'World War II ends',
      1969: 'Moon landing',
      // Add more significant events
    };
  }

  buildLocationHistory() {
    return {
      // Track historical place name changes
      'Danzig': { validYears: [1200, 1945], modernName: 'Gdansk, Poland' },
      'Königsberg': { validYears: [1255, 1946], modernName: 'Kaliningrad, Russia' },
      'Constantinople': { validYears: [330, 1930], modernName: 'Istanbul, Turkey' },
      // Add more historical places
    };
  }

  buildSourceReliability() {
    return {
      'government_record': { score: 0.95, level: 'excellent' },
      'church_record': { score: 0.90, level: 'very_good' },
      'census': { score: 0.85, level: 'good' },
      'newspaper': { score: 0.75, level: 'fair' },
      'family_bible': { score: 0.70, level: 'fair' },
      'oral_history': { score: 0.50, level: 'poor' },
      'unknown': { score: 0.30, level: 'very_poor' }
    };
  }

  validateLocationHistory(location, year) {
    // Simplified location validation
    const locationKey = location.toLowerCase();
    
    if (this.locationHistory[locationKey]) {
      const entry = this.locationHistory[locationKey];
      if (year < entry.validYears[0] || year > entry.validYears[1]) {
        return {
          isValid: false,
          reason: `${location} not historically accurate for ${year}. Consider ${entry.modernName}`
        };
      }
    }
    
    return { isValid: true };
  }

  findHistoricalContext(dateString) {
    const year = this.extractYear(dateString);
    if (!year) return [];
    
    const relevantEvents = [];
    for (const [eventYear, event] of Object.entries(this.historicalEvents)) {
      if (Math.abs(parseInt(eventYear) - year) <= 5) {
        relevantEvents.push(event);
      }
    }
    
    return relevantEvents;
  }

  assessDatePrecision(dateString) {
    if (dateString.match(/\d{4}-\d{2}-\d{2}/)) {
      return { score: 1.0, level: 'exact_date' };
    } else if (dateString.match(/\d{4}-\d{2}/)) {
      return { score: 0.9, level: 'month_year' };
    } else if (dateString.match(/\d{4}/)) {
      return { score: 0.8, level: 'year_only' };
    } else if (dateString.includes('circa') || dateString.includes('about')) {
      return { score: 0.6, level: 'approximate' };
    } else {
      return { score: 0.4, level: 'imprecise' };
    }
  }

  assessSourceReliability(sources) {
    if (!sources || sources.length === 0) {
      return { score: 0.3, level: 'no_sources' };
    }
    
    let totalScore = 0;
    sources.forEach(source => {
      const sourceType = source.type || 'unknown';
      const reliability = this.sourceReliability[sourceType] || this.sourceReliability['unknown'];
      totalScore += reliability.score;
    });
    
    const avgScore = totalScore / sources.length;
    return {
      score: avgScore,
      level: avgScore > 0.9 ? 'excellent' : avgScore > 0.8 ? 'very_good' : avgScore > 0.7 ? 'good' : 'fair'
    };
  }

  getQualityRecommendation(score) {
    if (score >= 0.9) return 'Excellent data quality';
    if (score >= 0.8) return 'Good data quality';
    if (score >= 0.7) return 'Fair data quality - consider additional research';
    if (score >= 0.6) return 'Poor data quality - significant gaps or issues';
    return 'Very poor data quality - extensive verification needed';
  }
}

module.exports = { GenealogyValidationService };