/**
 * NYSIIS (New York State Identification and Intelligence System)
 * Phonetic algorithm for name matching
 */

class PhoneticMatchers {
  /**
   * NYSIIS encoding algorithm
   */
  nysiis(name) {
    if (!name || typeof name !== 'string') return '';
    
    let encoded = name.toUpperCase().trim();
    
    // Remove non-alphabetic characters
    encoded = encoded.replace(/[^A-Z]/g, '');
    
    if (encoded.length === 0) return '';
    
    // Step 1: Translate first characters
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
    
    // Step 2: Translate last characters
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
    
    // Step 3: Replace vowels
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
    
    // Step 4: Remove duplicate characters
    let result = first;
    for (let i = 1; i < encoded.length; i++) {
      if (encoded.charAt(i) !== encoded.charAt(i - 1)) {
        result += encoded.charAt(i);
      }
    }
    
    // Step 5: Remove trailing 'A' or 'S'
    if (result.length > 1) {
      if (result.endsWith('A') || result.endsWith('S')) {
        result = result.substring(0, result.length - 1);
      }
    }
    
    // Step 6: Replace 'AY' with 'Y' at end
    if (result.endsWith('AY')) {
      result = result.substring(0, result.length - 2) + 'Y';
    }
    
    return result;
  }

  /**
   * Compare two names using NYSIIS
   */
  nysiisMatch(name1, name2) {
    const code1 = this.nysiis(name1);
    const code2 = this.nysiis(name2);
    
    return {
      match: code1 === code2,
      code1,
      code2,
      confidence: code1 === code2 ? 1.0 : 0
    };
  }

  /**
   * Soundex implementation (already exists, but added for completeness)
   */
  soundex(name) {
    if (!name) return '';
    
    const s = name.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 0) return '';
    
    const first = s.charAt(0);
    const codes = {
      'BFPV': '1', 'CGJKQSXZ': '2', 'DT': '3',
      'L': '4', 'MN': '5', 'R': '6'
    };
    
    let encoded = first;
    for (let i = 1; i < s.length && encoded.length < 4; i++) {
      const char = s.charAt(i);
      for (const [key, value] of Object.entries(codes)) {
        if (key.includes(char)) {
          if (encoded.charAt(encoded.length - 1) !== value) {
            encoded += value;
          }
          break;
        }
      }
    }
    
    return encoded.padEnd(4, '0').substring(0, 4);
  }

  /**
   * Metaphone implementation
   */
  metaphone(name) {
    if (!name) return '';
    
    let s = name.toUpperCase().replace(/[^A-Z]/g, '');
    if (s.length === 0) return '';
    
    // Simplified Metaphone
    s = s.replace(/KN/, 'N')
         .replace(/GN/, 'N')
         .replace(/PN/, 'N')
         .replace(/AE/, 'E')
         .replace(/WR/, 'R')
         .replace(/X/, 'KS')
         .replace(/([AEIOU])\1+/, '$1');
    
    return s.substring(0, 4);
  }
}

module.exports = new PhoneticMatchers();