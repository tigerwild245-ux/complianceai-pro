// server/services/aiNameMatcher.js
const { getGroqResponse } = require('./groqService');
const transformerService = require('./transformerService'); // Gemini embeddings
const phoneticMatchers = require('../utils/phoneticMatchers');

class AINameMatcher {
  constructor() {
    this.variantCache = new Map(); // In-memory cache for speed
  }

  // Groq: Generate intelligent variants (misspellings, transliterations)
  async getVariants(inputName) {
    const cacheKey = inputName.toLowerCase();
    if (this.variantCache.has(cacheKey)) return this.variantCache.get(cacheKey);

    const prompt = `Generate 5-8 REALISTIC name variants/corrections for: "${inputName}"
RULES:
- Fix common misspellings (Veladmir→Vladimir, Buten→Putin, Abdulla→Abdullah/Abd Allah)
- Arabic transliterations (Mohamed→Muhammad/Mohammed, Hassan→Hasan)
- English variations (Jon→John/Jonathan)
- Presidents/PEPs: Vladimir Putin, etc.
- Return JSON array ONLY: ["exact", "variant1", "variant2", ...]`;

    try {
      const response = await getGroqResponse(prompt);
      const variants = JSON.parse(response.replace(/```json|```/g, '').trim());
      const result = Array.isArray(variants) ? variants.slice(0, 8) : [inputName];
      this.variantCache.set(cacheKey, result);
      return result;
    } catch {
      return [inputName, inputName.replace(/\s/g, '')]; // Safe fallback
    }
  }

  // Groq: Verify if same person (final gatekeeper)
  async verifyMatch(queryName, candidateName, score) {
    const prompt = `Same person? Query: "${queryName}" Candidate: "${candidateName}" Initial Score: ${score.toFixed(0)}%
Consider: misspellings, transliteration (Abdulla=Abdullah), cultural variants, PEPs/Presidents.
Respond JSON: {"same_person": true/false, "confidence": 0-100, "reason": "brief"}`;

    try {
      const response = await getGroqResponse(prompt);
      return JSON.parse(response.replace(/```json|```/g, '').trim());
    } catch {
      return { same_person: score > 70, confidence: Math.min(100, score), reason: 'AI unavailable' };
    }
  }

  // Full super detective score (MAIN ENTRY POINT)
  async superMatchScore(queryName, candidate) {
    const variants = await this.getVariants(queryName);
    let bestScore = 0;
    let method = 'DB';

    // 1. Multi-variant semantic (Gemini - precise)
    for (const variant of variants) {
      const semantic = await transformerService.semanticSimilarity(variant, candidate.entity_name);
      if (semantic.confidence > bestScore) {
        bestScore = semantic.confidence * 100;
        method = `Semantic(${variant.slice(0,10)}...)`;
      }
    }

    // 2. Phonetic boost (rule-based fast)
    const phonetic = phoneticMatchers.nysiisMatch(queryName, candidate.entity_name);
    if (phonetic.match) {
      bestScore = Math.min(100, bestScore + 25);
      method += ' + Phonetic';
    }

    // 3. Groq verification (human-like judgment)
    const verification = await this.verifyMatch(queryName, candidate.entity_name, bestScore);
    if (verification.same_person) {
      bestScore = Math.min(100, bestScore + (verification.confidence / 2));
      method += ` + AI Verify(${verification.confidence}%)`;
    }

    // 4. Domain boosts
    if (candidate.is_pep) bestScore += 15;
    if (candidate.program?.toLowerCase().includes('president') || candidate.program?.toLowerCase().includes('minister')) bestScore += 10;

    return {
      finalScore: Math.min(100, bestScore),
      analysis: method,
      variants_used: variants,
      verification
    };
  }
}

module.exports = new AINameMatcher();