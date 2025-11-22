// server/utils/phoneticMatcher.js
const phoneticMatchers = require('./phoneticMatchers');

class PhoneticMatcher {
  /**
   * Multi-algorithm phonetic matching with confidence scoring
   * @param {string} name1 - First name to compare
   * @param {string} name2 - Second name to compare
   * @returns {object} Match result with confidence and details
   */
  match(name1, name2) {
    // 🛡️ Input validation
    if (!name1 || !name2 || typeof name1 !== 'string' || typeof name2 !== 'string') {
      return {
        match: false,
        confidence: 0,
        details: { error: 'Invalid input' }
      };
    }

    // Normalize names (critical for accurate matching)
    const normalized1 = this.normalizeName(name1);
    const normalized2 = this.normalizeName(name2);
    
    // Reject very short names (too ambiguous)
    if (normalized1.length < 2 || normalized2.length < 2) {
      return {
        match: normalized1 === normalized2,
        confidence: 1.0,
        details: { tooShort: true }
      };
    }

    // Generate phonetic codes
    const soundex1 = phoneticMatchers.soundex(normalized1);
    const soundex2 = phoneticMatchers.soundex(normalized2);
    
    const metaphone1 = phoneticMatchers.metaphone(normalized1);
    const metaphone2 = phoneticMatchers.metaphone(normalized2);
    
    const nysiis1 = phoneticMatchers.nysiis(normalized1);
    const nysiis2 = phoneticMatchers.nysiis(normalized2);

    // Score each algorithm
    const soundexMatch = soundex1 === soundex2 && soundex1 !== '0000'; // Soundex returns 0000 for no match
    const metaphoneMatch = metaphone1 === metaphone2 && metaphone1 !== '';
    const nysiisMatch = nysiis1 === nysiis2 && nysiis1 !== '';

    // Voting system
    const matches = [soundexMatch, metaphoneMatch, nysiisMatch].filter(Boolean).length;
    const confidence = matches / 3;

    return {
      match: matches >= 2, // 2-out-of-3 voting
      confidence: confidence,
      confidencePercent: Math.round(confidence * 100),
      details: { 
        soundexMatch, 
        metaphoneMatch, 
        nysiisMatch,
        soundex1, 
        soundex2,
        metaphone1,
        metaphone2,
        nysiis1,
        nysiis2,
        normalizedNames: [normalized1, normalized2]
      }
    };
  }

  /**
   * Normalize names for better matching
   */
  normalizeName(name) {
    return name
      .toUpperCase()
      .trim()
      .replace(/[^A-Z\s]/g, ' ') // Remove special chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  }

  /**
   * Batch match for performance
   */
  batchMatch(inputName, candidateNames) {
    return candidateNames.map(candidate => ({
      name: candidate,
      result: this.match(inputName, candidate)
    }));
  }

  /**
   * Get best match from array
   */
  findBestMatch(inputName, candidateNames, threshold = 0.5) {
    const results = this.batchMatch(inputName, candidateNames);
    const bestMatch = results
      .filter(r => r.result.confidence >= threshold)
      .sort((a, b) => b.result.confidence - a.result.confidence)[0];
    
    return bestMatch || null;
  }
}

module.exports = new PhoneticMatcher();