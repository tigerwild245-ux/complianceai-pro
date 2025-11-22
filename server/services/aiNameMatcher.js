// server/services/aiNameMatcher.js
const { generateArabicVariants, generateTargetedVariants } = require('../utils/arabicTransliterator');
const { getGroqResponse } = require('./groqService');
const transformerService = require('./transformerService'); // Gemini embeddings
const phoneticMatchers = require('../utils/phoneticMatchers');

class AINameMatcher {
  constructor() {
    this.variantCache = new Map(); // In-memory cache for speed
  }

  // Enhanced: Combine Groq AI + Arabic transliteration variants
  async getVariants(inputName) {
    const cacheKey = inputName.toLowerCase();
    if (this.variantCache.has(cacheKey)) return this.variantCache.get(cacheKey);

    // Step 1: Get Arabic transliteration variants (instant, rule-based)
    const arabicVariants = generateArabicVariants(inputName);
    console.log(`🔤 Generated ${arabicVariants.length} Arabic variants for "${inputName}"`);

    // Step 2: Get AI-powered variants (intelligent corrections)
    const prompt = `Generate 5-8 REALISTIC name variants/corrections for: "${inputName}"
RULES:
- Fix common misspellings (Veladmir→Vladimir, Buten→Putin, Abdulla→Abdullah/Abd Allah)
- Arabic transliterations (Mohamed→Muhammad/Mohammed, Hassan→Hasan)
- English variations (Jon→John/Jonathan)
- Presidents/PEPs: Vladimir Putin, etc.
- Return JSON array ONLY: ["exact", "variant1", "variant2", ...]`;

    let aiVariants = [];
    try {
      const response = await getGroqResponse(prompt);
      const parsed = JSON.parse(response.replace(/```json|```/g, '').trim());
      aiVariants = Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch (error) {
      console.warn('⚠️ Groq AI variants failed, using fallback');
      aiVariants = [inputName, inputName.replace(/\s/g, '')];
    }

    // Step 3: Combine and deduplicate all variants
    const allVariants = [
      inputName, // Original always first
      ...arabicVariants.slice(0, 30), // Top 30 Arabic variants
      ...aiVariants, // AI-generated variants
      inputName.replace(/\s+/g, ''), // No spaces version
      inputName.replace(/[.-]/g, ' ') // Normalize punctuation
    ];

    // Deduplicate (case-insensitive)
    const uniqueVariants = [...new Set(
      allVariants.map(v => v.trim()).filter(v => v.length > 2)
    )].slice(0, 50); // Limit to 50 variants max

    console.log(`✅ Final variant count: ${uniqueVariants.length}`);
    
    this.variantCache.set(cacheKey, uniqueVariants);
    return uniqueVariants;
  }

  // Groq: Verify if same person (final gatekeeper)
  async verifyMatch(queryName, candidateName, score) {
    const prompt = `Same person? Query: "${queryName}" Candidate: "${candidateName}" Initial Score: ${score.toFixed(0)}%
Consider: 
- Misspellings and typos
- Arabic transliterations (Mohamed/Mohammed/Muhammad are same, Abdulla/Abdullah/Abd Allah are same)
- Cultural variants (Hassan/Hasan, Ahmad/Ahmed)
- PEPs/Presidents/Ministers
- Vowel differences (Subhy/Sobhy, Hadi/Hady)

Respond JSON: {"same_person": true/false, "confidence": 0-100, "reason": "brief explanation"}`;

    try {
      const response = await getGroqResponse(prompt);
      const result = JSON.parse(response.replace(/```json|```/g, '').trim());
      console.log(`🤖 AI Verification: ${result.same_person ? '✅ MATCH' : '❌ NO MATCH'} (${result.confidence}%) - ${result.reason}`);
      return result;
    } catch (error) {
      console.warn('⚠️ AI verification failed, using score-based fallback');
      return { 
        same_person: score > 70, 
        confidence: Math.min(100, score), 
        reason: 'AI unavailable, used score threshold' 
      };
    }
  }

  // Calculate basic string similarity (fuzzy matching)
  calculateStringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();
    
    // Exact match
    if (s1 === s2) return 100;
    
    // Contains match
    if (s1.includes(s2) || s2.includes(s1)) return 85;
    
    // Levenshtein distance (simple version)
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    
    if (longer.length === 0) return 100;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return Math.max(0, ((longer.length - editDistance) / longer.length) * 100);
  }

  // Simple Levenshtein distance implementation
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Full super detective score (MAIN ENTRY POINT)
  async superMatchScore(queryName, candidate) {
    console.log(`\n🔍 Matching "${queryName}" against "${candidate.entity_name}"`);
    
    const variants = await this.getVariants(queryName);
    let bestScore = 0;
    let method = 'None';
    let bestVariant = queryName;

    // 1. Multi-variant semantic similarity (Gemini - most accurate)
    for (const variant of variants.slice(0, 20)) { // Check top 20 variants
      try {
        const semantic = await transformerService.semanticSimilarity(variant, candidate.entity_name);
        if (semantic.confidence > bestScore) {
          bestScore = semantic.confidence * 100;
          method = `Semantic(${variant})`;
          bestVariant = variant;
        }
      } catch (error) {
        console.warn(`⚠️ Semantic check failed for variant: ${variant}`);
      }
    }

    // 2. String similarity fallback (if semantic failed or low score)
    if (bestScore < 60) {
      for (const variant of variants.slice(0, 30)) {
        const stringSim = this.calculateStringSimilarity(variant, candidate.entity_name);
        if (stringSim > bestScore) {
          bestScore = stringSim;
          method = `String(${variant})`;
          bestVariant = variant;
        }
      }
    }

    // 3. Phonetic boost (catches sound-alike names)
    const phonetic = phoneticMatchers.nysiisMatch(queryName, candidate.entity_name);
    if (phonetic.match) {
      bestScore = Math.min(100, bestScore + 20);
      method += ' + Phonetic';
      console.log(`🎵 Phonetic match bonus: +20`);
    }

    // 4. Groq AI verification (final human-like judgment)
    let verification = null;
    if (bestScore > 50) { // Only verify if there's a reasonable initial match
      verification = await this.verifyMatch(queryName, candidate.entity_name, bestScore);
      if (verification.same_person) {
        const aiBoost = Math.min(30, verification.confidence / 3);
        bestScore = Math.min(100, bestScore + aiBoost);
        method += ` + AI(${verification.confidence}%)`;
        console.log(`🤖 AI verification boost: +${aiBoost.toFixed(1)}`);
      }
    }

    // 5. Domain-specific boosts
    let domainBoost = 0;
    if (candidate.is_pep) {
      domainBoost += 10;
      console.log(`👑 PEP boost: +10`);
    }
    if (candidate.program?.toLowerCase().includes('president') || 
        candidate.program?.toLowerCase().includes('minister')) {
      domainBoost += 8;
      console.log(`🏛️ High-profile boost: +8`);
    }
    
    bestScore = Math.min(100, bestScore + domainBoost);

    const finalScore = Math.min(100, Math.max(0, bestScore));
    
    console.log(`📊 Final Score: ${finalScore.toFixed(1)}% via ${method}`);
    
    return {
      finalScore: finalScore,
      analysis: method,
      bestVariant: bestVariant,
      variants_used: variants.length,
      verification: verification,
      match_quality: finalScore >= 85 ? 'HIGH' : finalScore >= 70 ? 'MEDIUM' : 'LOW'
    };
  }

  // Batch matching for multiple candidates
  async matchMultipleCandidates(queryName, candidates) {
    console.log(`\n🔎 Batch matching "${queryName}" against ${candidates.length} candidates`);
    
    const results = [];
    for (const candidate of candidates) {
      const matchResult = await this.superMatchScore(queryName, candidate);
      results.push({
        candidate: candidate,
        ...matchResult
      });
    }
    
    // Sort by score descending
    results.sort((a, b) => b.finalScore - a.finalScore);
    
    // Filter matches above threshold
    const significantMatches = results.filter(r => r.finalScore >= 70);
    
    console.log(`✅ Found ${significantMatches.length} significant matches (≥70%)`);
    
    return {
      matches: significantMatches,
      all_results: results,
      best_match: results[0] || null
    };
  }
}

module.exports = new AINameMatcher();