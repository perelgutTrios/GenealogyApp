// Basic GEDCOM Parser
// This parser extracts basic information from GEDCOM files

const parseGedcomContent = (gedcomContent) => {
  const lines = gedcomContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const individuals = [];
  const families = [];
  
  let currentRecord = null;
  let currentType = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(' ');
    const level = parseInt(parts[0]);
    
    if (level === 0) {
      // Save previous record if exists
      if (currentRecord && currentType === 'INDI') {
        individuals.push(currentRecord);
      } else if (currentRecord && currentType === 'FAM') {
        families.push(currentRecord);
      }
      
      // Start new record
      if (parts.length >= 3) {
        const id = parts[1];
        const type = parts[2];
        
        if (type === 'INDI') {
          currentRecord = {
            id: id,
            givenNames: '',
            familyNames: '',
            birthDate: '',
            birthPlace: '',
            deathDate: '',
            deathPlace: '',
            sex: ''
          };
          currentType = 'INDI';
        } else if (type === 'FAM') {
          currentRecord = {
            id: id,
            husband: '',
            wife: '',
            children: [],
            marriageDate: '',
            marriagePlace: ''
          };
          currentType = 'FAM';
        } else {
          currentRecord = null;
          currentType = null;
        }
      }
    } else if (level === 1 && currentRecord) {
      // Level 1 tags
      if (currentType === 'INDI') {
        parseIndividualTag(line, currentRecord, lines, i);
      } else if (currentType === 'FAM') {
        parseFamilyTag(line, currentRecord);
      }
    }
  }
  
  // Don't forget the last record
  if (currentRecord && currentType === 'INDI') {
    individuals.push(currentRecord);
  } else if (currentRecord && currentType === 'FAM') {
    families.push(currentRecord);
  }
  
  return {
    individuals: individuals,
    families: families,
    totalIndividuals: individuals.length,
    totalFamilies: families.length
  };
};

const parseIndividualTag = (line, individual, lines, currentIndex) => {
  const parts = line.split(' ');
  const tag = parts[1];
  
  switch (tag) {
    case 'NAME':
      if (parts.length > 2) {
        const namePart = line.substring(line.indexOf('NAME') + 5).trim();
        const nameMatch = namePart.match(/^([^\/]*)\/?([^\/]*)\/?/);
        if (nameMatch) {
          individual.givenNames = nameMatch[1].trim();
          individual.familyNames = nameMatch[2].trim();
        }
      }
      break;
      
    case 'SEX':
      if (parts.length > 2) {
        individual.sex = parts[2];
      }
      break;
      
    case 'BIRT':
      // Birth event - look for DATE and PLAC in following lines
      parseEvent(lines, currentIndex + 1, (tag, value) => {
        if (tag === 'DATE') individual.birthDate = value;
        if (tag === 'PLAC') individual.birthPlace = value;
      });
      break;
      
    case 'DEAT':
      // Death event - look for DATE and PLAC in following lines
      parseEvent(lines, currentIndex + 1, (tag, value) => {
        if (tag === 'DATE') individual.deathDate = value;
        if (tag === 'PLAC') individual.deathPlace = value;
      });
      break;
  }
};

const parseFamilyTag = (line, family) => {
  const parts = line.split(' ');
  const tag = parts[1];
  
  switch (tag) {
    case 'HUSB':
      if (parts.length > 2) {
        family.husband = parts[2];
      }
      break;
      
    case 'WIFE':
      if (parts.length > 2) {
        family.wife = parts[2];
      }
      break;
      
    case 'CHIL':
      if (parts.length > 2) {
        family.children.push(parts[2]);
      }
      break;
      
    case 'MARR':
      // Marriage event - would need to parse following lines for date/place
      break;
  }
};

const parseEvent = (lines, startIndex, callback) => {
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(' ');
    const level = parseInt(parts[0]);
    
    if (level === 2 && parts.length > 2) {
      const tag = parts[1];
      const value = line.substring(line.indexOf(tag) + tag.length + 1).trim();
      callback(tag, value);
    } else if (level <= 1) {
      // End of event
      break;
    }
  }
};

// Extract basic statistics from GEDCOM content
const getGedcomStats = (gedcomContent) => {
  try {
    const parsed = parseGedcomContent(gedcomContent);
    
    return {
      totalIndividuals: parsed.totalIndividuals,
      totalFamilies: parsed.totalFamilies,
      individuals: parsed.individuals,
      families: parsed.families,
      success: true
    };
  } catch (error) {
    console.error('GEDCOM parsing error:', error);
    return {
      totalIndividuals: 0,
      totalFamilies: 0,
      individuals: [],
      families: [],
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  parseGedcomContent,
  getGedcomStats
};