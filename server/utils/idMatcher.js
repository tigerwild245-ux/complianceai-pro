/**
 * ID Document Matching Utilities
 * Matches passport numbers, national IDs, and other identity documents
 */

class IdMatcher {
  constructor() {
    // Regex patterns for different ID types
    this.patterns = {
      passport: {
        US: /^[A-Z]{1,2}[0-9]{6,9}$/,
        UK: /^[0-9]{9}$/,
        EU: /^[A-Z]{2}[A-Z0-9]{6,9}$/,
        generic: /^[A-Z0-9]{6,12}$/
      },
      nationalId: {
        US_SSN: /^\d{3}-?\d{2}-?\d{4}$/,
        generic: /^[A-Z0-9]{8,20}$/
      }
    };
  }

  /**
   * Normalize ID for comparison
   */
  normalizeId(id) {
    if (!id) return '';
    return id.toString()
      .toUpperCase()
      .replace(/[\s\-_.]/g, '') // Remove separators
      .trim();
  }

  /**
   * Exact match for passport numbers
   */
  matchPassport(passport1, passport2, country = 'generic') {
    const norm1 = this.normalizeId(passport1);
    const norm2 = this.normalizeId(passport2);

    if (!norm1 || !norm2) return false;

    // Exact match
    if (norm1 === norm2) {
      return { match: true, confidence: 1.0, method: 'exact' };
    }

    // Partial match (for cases with prefixes/suffixes)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const minLen = Math.min(norm1.length, norm2.length);
      const maxLen = Math.max(norm1.length, norm2.length);
      const confidence = minLen / maxLen;
      
      if (confidence > 0.8) {
        return { match: true, confidence, method: 'partial' };
      }
    }

    return { match: false, confidence: 0, method: 'none' };
  }

  /**
   * Match national ID numbers
   */
  matchNationalId(id1, id2) {
    const norm1 = this.normalizeId(id1);
    const norm2 = this.normalizeId(id2);

    if (!norm1 || !norm2) return false;

    // Exact match
    if (norm1 === norm2) {
      return { match: true, confidence: 1.0, method: 'exact' };
    }

    return { match: false, confidence: 0, method: 'none' };
  }

  /**
   * Match any document number
   */
  matchDocument(doc1, doc2, type = 'passport') {
    if (type === 'passport') {
      return this.matchPassport(doc1, doc2);
    } else if (type === 'national_id') {
      return this.matchNationalId(doc1, doc2);
    }
    
    // Generic matching
    const norm1 = this.normalizeId(doc1);
    const norm2 = this.normalizeId(doc2);
    
    return {
      match: norm1 === norm2,
      confidence: norm1 === norm2 ? 1.0 : 0,
      method: norm1 === norm2 ? 'exact' : 'none'
    };
  }

  /**
   * Validate document format
   */
  validateDocument(docNumber, type = 'passport', country = 'generic') {
    const normalized = this.normalizeId(docNumber);
    
    if (type === 'passport') {
      const pattern = this.patterns.passport[country] || this.patterns.passport.generic;
      return pattern.test(normalized);
    } else if (type === 'national_id') {
      const pattern = this.patterns.nationalId[country] || this.patterns.nationalId.generic;
      return pattern.test(normalized);
    }
    
    return normalized.length >= 6 && normalized.length <= 20;
  }
}

module.exports = new IdMatcher();