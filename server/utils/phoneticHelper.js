const phoneticMatchers = require('./phoneticMatchers');

function phoneticMatch(name1, name2) {
  if (!name1 || !name2) {
    return {
      match: false,
      confidence: 0,
      matchCount: 0,
      details: {}
    };
  }

  try {
    const result = phoneticMatchers.multiMatch(name1, name2, {
      threshold: 0.5,
      algorithms: ['nysiis', 'soundex', 'metaphone']
    });
    
    const details = {
      soundex: result.results.find(r => r.algorithm === 'Soundex'),
      metaphone: result.results.find(r => r.algorithm === 'Metaphone'),
      nysiis: result.results.find(r => r.algorithm === 'NYSIIS')
    };
    
    return {
      match: result.match,
      confidence: result.confidence,
      confidencePercent: result.confidencePercent,
      matchCount: result.results.filter(r => r.match).length,
      algorithmsUsed: 3,
      details: details
    };
  } catch (error) {
    console.error('Phonetic error:', error.message);
    return {
      match: false,
      confidence: 0,
      matchCount: 0,
      details: { error: error.message }
    };
  }
}

function quickPhoneticMatch(name1, name2) {
  try {
    const result = phoneticMatchers.nysiisMatch(name1, name2);
    return result.match;
  } catch {
    return false;
  }
}

module.exports = {
  phoneticMatch,
  quickPhoneticMatch
};
