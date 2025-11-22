// server/utils/phoneticMatchers.js
/**
 * NYSIIS (New York State Identification and Intelligence System)
 * Phonetic algorithm for name matching
 */

class PhoneticMatchers {
  constructor() {
    // Add caching for performance
    this.cache = new Map();
    this.cacheMaxSize = 1000; // Prevent memory bloat
  }

  /**
   * NYSIIS encoding algorithm
   */
  nysiis(name) {
    // Check cache first
    const cacheKey = `nysiis:${name}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    if (!name || typeof name !== 'string') return '';
    
    let encoded = name.toUpperCase().trim();
    encoded = encoded.replace(/[^A-Z]/g, '');
    
    if (encoded.length === 0) return '';

    // Step1: Translate first characters
    const firstCharRules = {
      'MAC': 'MCC',
      'KN': 'N',
      'K': 'C',
      'PH': 'FF',
      'PF': 'FF',
      'SCH': 'SSS'
    };
    
    for (const [key, value] of Object.entries(firstCharRules)) {
      if (encoded.startsWith(key)) {
        encoded = value + encoded.substring(key.length);
        break;
      }
    }
    
    // Step2: Translate last characters
    const lastCharRules = {
      'EE': 'Y',
      'IE': 'Y',
      'DT': 'D',
      'RT': 'D',
      'RD': 'D',
      'NT': 'D',
      'ND': 'D'
    };
    
    for (const [key, value] of Object.entries(lastCharRules)) {
      if (encoded.endsWith(key)) {
        encoded = encoded.substring(0, encoded.length - key.length) + value;
        break;
      }
    }
    
    // Step3: Replace vowels and consonants
    const first = encoded.charAt(0);
    encoded = first + encoded.substring(1)
      .replace(/[AEIOU]/g, 'A')
      .replace(/Q/g, 'G')
      .replace(/Z/g, 'S')
      .replace(/M/g, 'N')
      .replace(/KN/g, 'N')
      .replace(/K/g, 'C')
      .replace(/SCH/g, 'SSS')
      .replace(/PH/g, 'FF');
    
    // Step4: Remove duplicate characters
    let result = first;
    for (let i = 1; i < encoded.length; i++) {
      if (encoded.charAt(i) !== encoded.charAt(i - 1)) {
        result += encoded.charAt(i);
      }
    }
    
    // Step5: Remove trailing 'A' or 'S'
    if (result.length > 1) {
      if (result.endsWith('A') || result.endsWith('S')) {
        result = result.substring(0, result.length - 1);
      }
    }
    
    // Step6: Replace 'AY' with 'Y' at end
    if (result.endsWith('AY')) {
      result = result.substring(0, result.length - 2) + 'Y';
    }

    // Cache result (manage cache size)
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(cacheKey, result);
    
    return result;
  }

  /**
   * Compare two names using NYSIIS
   */
  nysiisMatch(name1, name2) {
    const code1 = this.nysiis(name1);
    const code2 = this.nysiis(name2);
    
    return {
      match: code1 === code2 && code1 !== '',
      code1,
      code2,
      confidence: code1 === code2 && code1 !== '' ? 1.0 : 0,
      algorithm: 'NYSIIS'
    };
  }

  /**
   * Soundex implementation (enhanced)
   */
  soundex(name) {
    if (!name || typeof name !== 'string') return '';
    
    const s = name.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 0) return '';
    
    const first = s.charAt(0);
    const codes = {
      'BFPV': '1', 'CGJKQSXZ': '2', 'DT': '3',
      'L': '4', 'MN': '5', 'R': '6'
    };
    
    let encoded = first;
    for (let i = 1; i < s.length && encoded.length < 4; i++) {
      let found = false;
      for (const [key, value] of Object.entries(codes)) {
        if (key.includes(s.charAt(i))) {
          if (encoded.charAt(encoded.length - 1) !== value) {
            encoded += value;
          }
          found = true;
          break;
        }
      }
    }
    
    // Pad with zeros
    return encoded.padEnd(4, '0').substring(0, 4);
  }

  /**
   * Metaphone implementation (enhanced)
   */
  metaphone(name) {
    if (!name || typeof name !== 'string') return '';
    
    let s = name.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 0) return '';
    
    // Enhanced Metaphone rules
    s = s.replace(/^KN/, 'N')
         .replace(/^GN/, 'N')
         .replace(/^PN/, 'N')
         .replace(/^AE/, 'E')
         .replace(/^WR/, 'R')
         .replace(/X/g, 'KS')
         .replace(/([AEIOU])\1+/g, '\$1')
         .replace(/C[IEY]/g, 'S')
         .replace(/C/g, 'K')
         .replace(/T[IO]A/g, 'X')
         .replace(/TI(ON|AL)/g, 'X');
    
    return s.substring(0, 4);
  }

  /**
   * 🆕 Multi-algorithm matching with voting system
   */
  multiMatch(name1, name2, options = {}) {
    const {
      threshold = 0.5, // Require 50% confidence minimum
      algorithms = ['nysiis', 'soundex', 'metaphone']
    } = options;

    // Normalize inputs
    const n1 = this.normalizeName(name1);
    const n2 = this.normalizeName(name2);

    // Short-circuit for exact matches
    if (n1 === n2 && n1.length > 2) {
      return {
        match: true,
        confidence: 1.0,
        confidencePercent: 100,
        algorithmsUsed: algorithms,
        details: {
          message: 'Exact match after normalization'
        }
      };
    }

    const results = [];
    
    if (algorithms.includes('nysiis')) {
      results.push(this.nysiisMatch(name1, name2));
    }
    
    if (algorithms.includes('soundex')) {
      const s1 = this.soundex(name1);
      const s2 = this.soundex(name2);
      results.push({
        match: s1 === s2,
        confidence: s1 === s2 ? 1.0 : 0,
        algorithm: 'Soundex'
      });
    }
    
    if (algorithms.includes('metaphone')) {
      const m1 = this.metaphone(name1);
      const m2 = this.metaphone(name2);
      results.push({
        match: m1 === m2,
        confidence: m1 === m2 ? 1.0 : 0,
        algorithm: 'Metaphone'
      });
    }

    const matches = results.filter(r => r.match).length;
    const confidence = matches / results.length;

    return {
      match: confidence >= threshold,
      confidence: confidence,
      confidencePercent: Math.round(confidence * 100),
      algorithmsUsed: algorithms,
      results: results, // Full breakdown for debugging
      threshold: threshold
    };
  }

  /**
   * 🆕 Batch process multiple candidates
   */
  batchMatch(inputName, candidates, options = {}) {
    return candidates.map(candidate => ({
      candidate,
      result: this.multiMatch(inputName, candidate, options)
    })).filter(r => r.result.match)
      .sort((a, b) => b.result.confidence - a.result.confidence);
  }

  /**
   * 🆕 Find best match with threshold
   */
  findBestMatch(inputName, candidates, threshold = 0.5) {
    const results = this.batchMatch(inputName, candidates, { threshold });
    return results[0] || null;
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
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
  }
}

module.exports = new PhoneticMatchers();