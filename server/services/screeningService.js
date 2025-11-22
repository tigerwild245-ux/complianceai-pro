// server/services/screeningService.js
const supabase = require('../config/supabaseClient');
const transformerService = require('./transformerService');
const idMatcher = require('../utils/idMatcher');
const { logScreeningEvent } = require('./auditService');
const { analyzeSanctionsMatch } = require('./aiAnalysisService');
const { generateBioForPEP } = require('../services/bioService');
const aiNameMatcher = require('./aiNameMatcher');
const phoneticMatchers = require('../utils/phoneticMatchers'); // 🆕 Multi-algorithm phonetics
const NodeCache = require('node-cache');

// ==========================================
// CONFIGURATION
// ==========================================
const searchCache = new NodeCache({ 
  stdTTL: 3600, 
  checkperiod: 120,
  useClones: false,
  deleteOnExpire: false // Keep expired entries for analytics
});

// Validation constants
const MIN_INPUT_LENGTH = 2;
const MAX_INPUT_LENGTH = 200;

// Risk thresholds
const AI_THRESHOLD_SCORE = 70;
const AI_THRESHOLD_CROSS_LANGUAGE = 60;
const AI_THRESHOLD_PEP = 55;

// Performance constants
const DB_RESULT_LIMIT = 20;
const MAX_CANDIDATES_TO_ANALYZE = 30;
const MAX_RESULTS_TO_RETURN = 10;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const hasArabic = (str) => /[\u0600-\u06FF]/.test(str);
const hasLatin = (str) => /[a-zA-Z]/.test(str);

const sanitizeInput = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.trim().substring(0, MAX_INPUT_LENGTH);
};

const validateInput = (inputName) => {
  if (!inputName || typeof inputName !== 'string') {
    return { valid: false, error: 'Name is required and must be a string' };
  }
  const cleaned = sanitizeInput(inputName);
  if (cleaned.length < MIN_INPUT_LENGTH) {
    return { valid: false, error: `Name must be at least ${MIN_INPUT_LENGTH} characters` };
  }
  return { valid: true, cleaned };
};

const generateCacheKey = (inputName, inputDetails) => {
  const detailsStr = Object.keys(inputDetails).length > 0 
    ? JSON.stringify(inputDetails) 
    : '';
  return `screen:${inputName.toLowerCase()}:${detailsStr}`;
};

// 🛡️ SAFE: Multi-layered AI trigger logic
const shouldTriggerAI = (score, inputName, candidate) => {
  if (!candidate || !candidate.entity_name) return false;
  
  const isCrossLanguage = 
    (hasArabic(inputName) && hasLatin(candidate.entity_name)) ||
    (hasLatin(inputName) && hasArabic(candidate.entity_name));
    
  // Enhanced PEP detection
  if (candidate.is_pep && 
      (candidate.pep_level === 'NATIONAL' || candidate.pep_level === 'REGIONAL') &&
      isCrossLanguage &&
      score >= AI_THRESHOLD_PEP) {
    return true;
  }
  
  if (isCrossLanguage && score >= AI_THRESHOLD_CROSS_LANGUAGE) return true;
  if (score >= AI_THRESHOLD_SCORE) return true;
  
  return false;
};

// ==========================================
// CORE SEARCH & ANALYSIS
// ==========================================

const performDatabaseSearch = async (cleanInput) => {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('search_sanctions', {
      search_name: cleanInput,
      result_limit: DB_RESULT_LIMIT
    });
    
    if (error) {
      console.error('🔍 DB Search Error:', error.message);
      return { data: null, error, duration: Date.now() - startTime };
    }
    
    // 🛡️ Ensure data is array and remove duplicates
    const uniqueData = Array.isArray(data) ? [...new Map(data.map(item => [item.id, item])).values()] : [];
    
    return { data: uniqueData, error: null, duration: Date.now() - startTime };
  } catch (err) {
    console.error('🔍 DB Search Exception:', err.message);
    return { data: null, error: err, duration: Date.now() - startTime };
  }
};

const performSemanticAnalysis = async (inputName, candidateName) => {
  if (!inputName || !candidateName) return null;
  
  try {
    const semanticResult = await transformerService.semanticSimilarity(inputName, candidateName);
    return semanticResult?.confidence ? semanticResult.confidence * 100 : null;
  } catch (err) {
    console.warn(`⚠️ Semantic analysis skipped: ${err.message}`);
    return null;
  }
};

// 🆕 Enhanced phonetic scoring using multi-algorithm matcher
const calculatePhoneticBonus = (name1, name2) => {
  const result = phoneticMatchers.multiMatch(name1, name2, { 
    threshold: 0.5,
    algorithms: ['nysiis', 'soundex', 'metaphone']
  });
  
  if (result.match) {
    console.log(`🎵 Phonetic match: ${result.confidencePercent}% (${result.algorithmsUsed.join(', ')})`);
    
    // Tiered bonus based on confidence
    if (result.confidence >= 0.8) return 25; // High confidence (80%+)
    if (result.confidence >= 0.6) return 20; // Medium confidence (60%+)
    return 15; // Low confidence (50%+)
  }
  
  return 0;
};

const calculateMatchScore = async (candidate, inputName, inputDetails) => {
  if (!candidate || !candidate.entity_name) {
    return {
      finalScore: 0,
      analysisLog: ['ERROR: Invalid candidate data'],
      ai_verification: null,
      phonetic_variants: []
    };
  }

  try {
    // Use AI-powered super matcher
    const aiResult = await aiNameMatcher.superMatchScore(inputName, candidate);
    
    // Add phonetic bonus
    const phoneticBonus = calculatePhoneticBonus(inputName, candidate.entity_name);
    
    return {
      finalScore: (aiResult.finalScore || 0) + phoneticBonus,
      analysisLog: aiResult.analysis || [],
      ai_verification: aiResult.verification || null,
      phonetic_variants: aiResult.variants_used?.slice(0, 3) || [],
      phoneticBonus: phoneticBonus
    };
  } catch (error) {
    console.error('❌ Error in calculateMatchScore:', error);
    return {
      finalScore: 0,
      analysisLog: [`Calculation error: ${error.message}`],
      ai_verification: null,
      phonetic_variants: []
    };
  }
};

// 🛡️ Robust match analyzer with progressive filtering
const analyzeMatches = async (potentialMatches, inputName, inputDetails) => {
  if (!Array.isArray(potentialMatches) || potentialMatches.length === 0) {
    console.log('🔬 No potential matches to analyze');
    return [];
  }

  // Progressively analyze candidates
  const analyzedPromises = potentialMatches.slice(0, MAX_CANDIDATES_TO_ANALYZE).map(candidate => {
    // Ensure candidate has required fields
    const safeCandidate = {
      id: candidate.id || Math.random().toString(36),
      entity_name: candidate.entity_name || candidate.name || '',
      list_source: candidate.list_source || candidate.source || 'Unknown',
      program: candidate.program || (candidate.is_pep ? 'PEP' : 'Sanctions'),
      ...candidate
    };
    
    return calculateMatchScore(safeCandidate, inputName, inputDetails);
  });
  
  const results = await Promise.allSettled(analyzedPromises);
  
  // Filter successful results and merge with original candidates
  const validMatches = results
    .filter(p => p.status === 'fulfilled' && p.value?.finalScore > 0)
    .map((p, index) => {
      const original = potentialMatches[index];
      const analysis = p.value;
      
      return {
        ...original,
        ...analysis,
        id: original.id || analysis.id, // Preserve original ID if available
        is_pep: !!original.is_pep, // 🛡️ Coerce to boolean
        finalScore: analysis.finalScore || 0
      };
    })
    .sort((a, b) => (b.finalScore || 0) - (a.finalScore || 0))
    .slice(0, MAX_RESULTS_TO_RETURN);

  console.log(`🔬 Super analysis complete: ${validMatches.length} high-quality matches`);
  return validMatches;
};

const performAIAnalysis = async (bestCandidate, inputName, inputDetails) => {
  if (!bestCandidate?.entity_name) {
    return {
      aiAnalysis: {
        risk_level: 'LOW',
        reasoning: 'No valid candidate for AI analysis',
        final_decision: 'CLEAR'
      },
      aiTime: 0
    };
  }

  const aiStartTime = Date.now();
  const candidateContext = {
    name: bestCandidate.entity_name,
    type: bestCandidate.entity_type || 'Unknown',
    source: bestCandidate.list_source,
    program: bestCandidate.program,
    isPEP: bestCandidate.is_pep || false,
    remarks: bestCandidate.remarks,
    score: bestCandidate.finalScore || 0
  };

  const aiAnalysis = await analyzeSanctionsMatch(inputName, inputDetails, candidateContext);
  return { aiAnalysis, aiTime: Date.now() - aiStartTime };
};

// 🛡️ Safe formatter with data validation
const formatMatches = (analyzedMatches) => {
  if (!Array.isArray(analyzedMatches)) return [];
  
  return analyzedMatches.map((m, index) => ({
    id: m.id || `match-${index}`,
    entity_name: m.entity_name || m.name || 'Unknown Entity',
    list_type: m.list_source || m.source || 'Unknown List',
    match_score: Math.min(Math.round(m.finalScore || 0), 100),
    program: m.program || (m.is_pep ? 'PEP' : 'Sanctions'),
    nationalities: Array.isArray(m.nationalities) ? m.nationalities.filter(Boolean) : [],
    date_of_birth: m.date_of_birth || 'Not specified',
    is_pep: !!m.is_pep, // 🛡️ Safe boolean conversion
    entity_type: m.is_pep ? 'PEP' : 'Sanctions',
    bio: m.bio || m.entity_summary || null,
    analysisLog: Array.isArray(m.analysisLog) ? m.analysisLog : [],
    phonetic_matches: Array.isArray(m.phonetic_variants) ? m.phonetic_variants : [],
    ai_verification: m.ai_verification || null,
    phoneticBonus: m.phoneticBonus || 0
  }));
};

// ==========================================
// MAIN SCREENING FUNCTION
// ==========================================

async function screenName(inputName, inputDetails = {}, userId = 'anonymous', ipAddress = '0.0.0.0') {
  const screeningStartTime = Date.now();
  let dbTime = 0, analysisTime = 0, aiTime = 0;

  try {
    // STEP 0: VALIDATE INPUT
    const validation = validateInput(inputName);
    if (!validation.valid) {
      const errorResult = { 
        match_found: false,
        matches: [], 
        analysis: validation.error, 
        error: true, 
        risk_level: 'ERROR',
        timestamp: new Date().toISOString()
      };
      await logScreeningEvent(inputName, userId, ipAddress, errorResult);
      return errorResult;
    }
    
    const cleanInput = validation.cleaned;
    console.log(`🎯 Screening request for: "${cleanInput}"`);

    // STEP 1: CACHE CHECK
    const cacheKey = generateCacheKey(cleanInput, inputDetails);
    if (Object.keys(inputDetails).length === 0) {
      const cached = searchCache.get(cacheKey);
      if (cached) {
        console.log(`✅ Cache hit for: "${cleanInput}"`);
        return { ...cached, cached: true };
      }
    }

    // STEP 2: DATABASE SEARCH
    const dbResult = await performDatabaseSearch(cleanInput);
    dbTime = dbResult.duration;
    
    if (dbResult.error || !dbResult.data || dbResult.data.length === 0) {
        const noMatch = { 
          match_found: false,
          matches: [], 
          analysis: "No matches found in sanctions database",
          risk_level: "LOW",
          timestamp: new Date().toISOString(),
          performance: { db_time: dbTime }
        };
        await logScreeningEvent(cleanInput, userId, ipAddress, noMatch);
        return noMatch;
    }

    // STEP 3: ANALYZE & SCORE MATCHES
    const analyzedMatches = await analyzeMatches(dbResult.data, cleanInput, inputDetails);
    analysisTime = Date.now() - screeningStartTime - dbTime;
    
    if (analyzedMatches.length === 0) {
      const noMatch = { 
        match_found: false,
        matches: [], 
        analysis: "Analysis found no viable matches above threshold",
        risk_level: "LOW",
        timestamp: new Date().toISOString(),
        performance: { db_time: dbTime, analysis_time: analysisTime }
      };
      await logScreeningEvent(cleanInput, userId, ipAddress, noMatch);
      return noMatch;
    }

    const bestCandidate = analyzedMatches[0];
    console.log(`🏆 Best match: ${bestCandidate.entity_name} (Score: ${bestCandidate.finalScore})`);

    // STEP 4: RISK ASSESSMENT & BIO GENERATION
    let finalRisk = 'LOW';
    let generatedBio = null;
    
    // Generate bio for high-risk entities
    if (bestCandidate.is_pep || bestCandidate.finalScore >= 75) {
      try {
        generatedBio = await generateBioForPEP(
          bestCandidate.entity_name,
          bestCandidate.program,
          bestCandidate.phonetic_matches
        );
        console.log(`📄 Bio generated: ${generatedBio?.substring(0, 50)}...`);
      } catch (e) {
        console.log("⚠️ Bio generation skipped:", e.message);
      }
    }

    // Calculate mathematical risk
    const score = bestCandidate.finalScore || 0;
    if (score >= 96) finalRisk = 'CRITICAL';
    else if (score >= 76) finalRisk = 'HIGH';
    else if (score >= 50) finalRisk = 'MEDIUM';

    // STEP 5: AI ANALYSIS (for high-risk or cross-language)
    let aiAnalysis = {
      risk_level: finalRisk,
      reasoning: 'Initial mathematical risk assessment',
      final_decision: 'REVIEW'
    };

    if (shouldTriggerAI(score, cleanInput, bestCandidate)) {
      console.log('🤖 Starting AI analysis...');
      const aiResult = await performAIAnalysis(bestCandidate, cleanInput, inputDetails);
      aiAnalysis = aiResult.aiAnalysis;
      aiTime = aiResult.aiTime;
      
      // AI can upgrade risk level if justified
      if (aiAnalysis.risk_level && aiAnalysis.risk_level !== finalRisk) {
        const riskSeverity = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
        if (riskSeverity[aiAnalysis.risk_level] > riskSeverity[finalRisk]) {
          finalRisk = aiAnalysis.risk_level;
          console.log(`🚨 AI upgraded risk to: ${finalRisk}`);
        }
      }
    }

    // STEP 6: COMPILE FINAL RESPONSE
    const totalTime = Date.now() - screeningStartTime;
    
    // Generate professional titles
    const bioTitle = bestCandidate.is_pep 
      ? "Politically Exposed Person (PEP) Profile" 
      : "Sanctions Entity Profile";
    
    const improvedReasoning = aiAnalysis.reasoning || 
      `Mathematical similarity score of ${score}% indicates ${finalRisk.toLowerCase()} risk. ` +
      `${bestCandidate.is_pep ? 'PEP status' : 'Sanctions listing'} requires enhanced due diligence.`;

    const result = {
      match_found: true,
      name: cleanInput,
      matches: formatMatches(analyzedMatches),
      best_match: bestCandidate,
      
      // TOP-LEVEL FIELDS (for frontend compatibility)
      risk_level: finalRisk,
      risk_summary_title: "Risk Assessment Summary", 
      ai_assessment_title: "Due Diligence Analysis", 
      bio_title: bioTitle,
      
      bio: generatedBio || aiAnalysis.bio || null,
      ai_analysis: improvedReasoning,
      phonetic_suggestions: bestCandidate.phonetic_matches || [],
      
      // Enhanced toMatch structure
      topMatch: {
        decision: aiAnalysis.final_decision || "REVIEW",
        riskLevel: finalRisk,
        reasoning: improvedReasoning,
        bio: generatedBio || aiAnalysis.bio,
        confidence: score,
        entityId: bestCandidate.id,
        isPEP: bestCandidate.is_pep
      },
      
      // Performance metrics
      performance: {
        total_time: totalTime,
        db_time: dbTime,
        analysis_time: analysisTime,
        ai_time: aiTime,
        cache_hit: false
      },
      
      timestamp: new Date().toISOString(),
      metadata: {
        candidates_analyzed: dbResult.data.length,
        matches_returned: analyzedMatches.length,
        ai_triggered: aiTime > 0,
        phonetic_bonus_applied: bestCandidate.phoneticBonus || 0
      }
    };

    // STEP 7: CACHE & AUDIT
    if (Object.keys(inputDetails).length === 0) {
      searchCache.set(cacheKey, result);
    }
    
    console.log('📝 Logging screening event...');
    await logScreeningEvent(cleanInput, userId, ipAddress, result);

    return result;

  } catch (error) {
    console.error("❌ CRITICAL SCREENING ERROR:", error);
    
    const errorResult = {
      match_found: false,
      matches: [],
      analysis: "System error during screening",
      risk_level: "ERROR",
      error: process.env.NODE_ENV === 'development' ? error.message : "Internal screening error",
      timestamp: new Date().toISOString(),
      performance: {
        total_time: Date.now() - screeningStartTime
      }
    };
    
    await logScreeningEvent(inputName, userId, ipAddress, errorResult);
    return errorResult;
  }
}

// ==========================================
// EXPORTS
// ==========================================
module.exports = { 
  screenName,
  clearCache: () => {
    searchCache.flushAll();
    phoneticMatchers.clearCache();
    console.log('🗑️ All caches cleared');
  },
  
  // Test exports
  test: {
    validateInput: validateInput,
    shouldTriggerAI: shouldTriggerAI,
    calculatePhoneticBonus: calculatePhoneticBonus
  }
};