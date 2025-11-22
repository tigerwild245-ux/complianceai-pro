// server/services/screeningService.js
const supabase = require('../config/supabaseClient');
const transformerService = require('./transformerService');
const idMatcher = require('../utils/idMatcher');
const { logScreeningEvent } = require('./auditService');
const { analyzeSanctionsMatch } = require('./aiAnalysisService');
const { generateBioForPEP } = require('../services/bioService');
const aiNameMatcher = require('./aiNameMatcher'); // 🆕 ADDED
const NodeCache = require('node-cache');

// Initialize cache: 1 hour TTL, check expired keys every 2 minutes
const searchCache = new NodeCache({ 
  stdTTL: 3600, 
  checkperiod: 120,
  useClones: false 
});

// ==========================================
// CONSTANTS & THRESHOLDS
// ==========================================
const MIN_INPUT_LENGTH = 2;
const MAX_INPUT_LENGTH = 200;
const MAX_RESULTS_TO_ANALYZE = 5;
const DB_RESULT_LIMIT = 20;

// AI Thresholds
const AI_THRESHOLD_SCORE = 70;
const AI_THRESHOLD_CROSS_LANGUAGE = 60; 
const AI_THRESHOLD_PEP = 55; 

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const hasArabic = (str) => /[\u0600-\u06FF]/.test(str);
const hasLatin = (str) => /[a-zA-Z]/.test(str);

const sanitizeInput = (str) => {
  if (!str) return '';
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
  return `search:${inputName.toLowerCase()}:${detailsStr}`;
};

const shouldTriggerAI = (score, inputName, candidate) => {
  const isCrossLanguage = 
    (hasArabic(inputName) && hasLatin(candidate.entity_name || '')) ||
    (hasLatin(inputName) && hasArabic(candidate.entity_name || ''));
    
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
// CORE LOGIC (HELPER FUNCTIONS)
// ==========================================

const performDatabaseSearch = async (cleanInput) => {
  const startTime = Date.now();
  try {
    const { data, error } = await supabase.rpc('search_sanctions', {
      search_name: cleanInput,
      result_limit: DB_RESULT_LIMIT
    });
    return { data, error, duration: Date.now() - startTime };
  } catch (err) {
    return { data: null, error: err, duration: Date.now() - startTime };
  }
};

const performSemanticAnalysis = async (inputName, candidateName) => {
  try {
    const semanticResult = await transformerService.semanticSimilarity(inputName, candidateName);
    if (semanticResult && semanticResult.confidence) {
        return semanticResult.confidence * 100;
    }
  } catch (err) {
    console.warn(`⚠️ Semantic analysis skipped: ${err.message}`);
  }
  return null;
};

// 🆕 UPDATED: New AI-powered calculateMatchScore
const calculateMatchScore = async (candidate, inputName, inputDetails) => {
  const { finalScore, analysis, variants_used, verification } = await aiNameMatcher.superMatchScore(inputName, candidate);
  
  return {
    finalScore,
    analysisLog: analysis,
    ai_verification: verification,
    phonetic_variants: variants_used.slice(0, 3) // Top 3 for frontend
  };
};

// 🆕 UPDATED: Parallel processing with broader search
const analyzeMatches = async (potentialMatches, inputName, inputDetails) => {
  // Analyze top 30 for better coverage, return top 10
  const analyzed = await Promise.allSettled(
    potentialMatches.slice(0, 30).map(c => calculateMatchScore(c, inputName, inputDetails))
  );
  
  const valid = analyzed
    .filter(p => p.status === 'fulfilled')
    .map(p => ({ ...potentialMatches[analyzed.indexOf(p)], ...p.value }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, 10); // Return best 10

  console.log(`🔬 Super analysis complete: ${valid.length} matches`);
  return valid;
};

const performAIAnalysis = async (bestCandidate, inputName, inputDetails) => {
  const aiStartTime = Date.now();
  const candidateContext = {
    name: bestCandidate.entity_name,
    type: bestCandidate.entity_type,
    source: bestCandidate.list_source,
    program: bestCandidate.program,
    isPEP: bestCandidate.is_pep,
    remarks: bestCandidate.remarks,
    score: bestCandidate.finalScore || 0
  };

  const aiAnalysis = await analyzeSanctionsMatch(inputName, inputDetails, candidateContext);
  return { aiAnalysis, aiTime: Date.now() - aiStartTime };
};

// 🆕 UPDATED: Enhanced formatMatches with new fields
const formatMatches = (analyzedMatches) => analyzedMatches.map(m => ({
  entity_name: m.entity_name || m.name,
  list_type: m.list_source || m.source,
  match_score: Math.round(m.finalScore),
  program: m.program || (m.is_pep ? 'PEP' : 'Sanctions'),
  nationalities: Array.isArray(m.nationalities) ? m.nationalities : m.nationalities?.split(',') || [],
  date_of_birth: m.date_of_birth || 'Not specified',
  is_pep: !!m.is_pep,
  entity_type: m.is_pep ? 'PEP' : 'Sanctions', // Correct badge
  bio: m.bio || m.entity_summary,
  analysisLog: m.analysisLog,
  phonetic_matches: m.phonetic_variants || [],
  ai_verification: m.ai_verification
}));

// ==========================================
// MAIN FUNCTION
// ==========================================

async function screenName(inputName, inputDetails = {}, userId = 'anonymous', ipAddress = '0.0.0.0') {
  const screeningStartTime = Date.now();
  let dbTime = 0, analysisTime = 0, aiTime = 0;

  try {
    // STEP 0: VALIDATE
    const validation = validateInput(inputName);
    if (!validation.valid) return { matches: [], analysis: validation.error, error: true };
    const cleanInput = validation.cleaned;

    // STEP 1: CACHE
    const cacheKey = generateCacheKey(cleanInput, inputDetails);
    if (Object.keys(inputDetails).length === 0) {
      const cached = searchCache.get(cacheKey);
      if (cached) return { ...cached, cached: true };
    }

    // STEP 2: DB SEARCH
    const dbResult = await performDatabaseSearch(cleanInput);
    dbTime = dbResult.duration;
    if (dbResult.error || !dbResult.data || dbResult.data.length === 0) {
        const noMatch = { matches: [], analysis: "No matches found.", risk_level: "LOW" };
        await logScreeningEvent(cleanInput, userId, ipAddress, noMatch);
        return noMatch;
    }

    // STEP 3: ANALYZE MATCHES
    const analyzedMatches = await analyzeMatches(dbResult.data, cleanInput, inputDetails);
    analysisTime = Date.now() - screeningStartTime - dbTime;
    const bestCandidate = analyzedMatches[0];

    // ============================================================
    // STEP 4: RISK & BIO GENERATION
    // ============================================================
    
    // A. GENERATE BIO (🆕 UPDATED: with phonetic variants)
    let generatedBio = null;
    if (bestCandidate.is_pep || bestCandidate.finalScore > 75) {
        try {
            generatedBio = await generateBioForPEP(
              bestCandidate.entity_name, 
              bestCandidate.program, 
              analyzedMatches[0]?.phonetic_variants || []
            );
            console.log(`✅ Bio successfully generated for response: ${generatedBio?.substring(0, 50)}...`);
        } catch (e) {
            console.log("⚠️ Bio generation skipped:", e.message);
        }
    }

    // B. CALCULATE MATH RISK
    let calculatedRisk = 'LOW';
    const score = bestCandidate.finalScore;

    if (score >= 96) calculatedRisk = 'CRITICAL';
    else if (score >= 76) calculatedRisk = 'HIGH';
    else if (score >= 50) calculatedRisk = 'MEDIUM';

    // C. AI ANALYSIS
    let aiAnalysis = { 
        risk_level: 'LOW', 
        reasoning: 'Score based analysis',
        final_decision: 'REVIEW' 
    };

    if (shouldTriggerAI(bestCandidate.finalScore, cleanInput, bestCandidate)) {
        console.log('🤖 Starting AI analysis...');
        const aiResult = await performAIAnalysis(bestCandidate, cleanInput, inputDetails);
        aiAnalysis = aiResult.aiAnalysis;
        aiTime = aiResult.aiTime;
        console.log('✅ Groq analysis complete');
    }

    // D. FINAL RISK COMPARISON
    const riskSeverity = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    let finalRisk = calculatedRisk;
    
    if (aiAnalysis && aiAnalysis.risk_level) {
        const aiRiskStr = String(aiAnalysis.risk_level).toUpperCase();
        if (riskSeverity[aiRiskStr] && riskSeverity[aiRiskStr] > riskSeverity[calculatedRisk]) {
            finalRisk = aiRiskStr;
        }
    }

    // STEP 5: COMPILE RESULT
    const totalTime = Date.now() - screeningStartTime;

    // 🛑 NEW: Add bio to the best candidate for frontend compatibility
    if (analyzedMatches.length > 0) {
        // The bio only exists for the best match, so we attach it here.
        analyzedMatches[0].bio = generatedBio;
    }

    // Prepare the improved AI Assessment Wording
    const improvedAiReasoning = aiAnalysis.reasoning
        ? String(aiAnalysis.reasoning).replace(/candidate/gi, 'subject') 
        : `The subject, ${cleanInput}, has a **${bestCandidate.is_pep ? 'Politically Exposed Person (PEP)' : 'Sanctions'}** status, which indicates a heightened risk requiring thorough review.`;

    // Determine the professional title for the Bio/Profile section
    const bioTitle = bestCandidate.is_pep 
        ? "Politically Exposed Person (PEP) Profile" 
        : "Sanctions Entity Profile";

    // CRITICAL FIX: Ensure bio and ai_analysis are at the TOP LEVEL of response
    const result = {
        match_found: true,
        name: cleanInput,
        matches: formatMatches(analyzedMatches), 
        best_match: bestCandidate, 
        
        // ===== TOP LEVEL FIELDS (CRITICAL) - Updated Titles and Wording =====
        risk_level: finalRisk,
        
        // 🛑 New Professional Titles for Frontend Display (as requested)
        risk_summary_title: "Risk Assessment Summary", 
        ai_assessment_title: "Due Diligence Analysis", 
        
        // 🛑 NEW: Title for the Bio Section
        bio_title: bioTitle, 
        
        bio: generatedBio || aiAnalysis.bio || null,  
        ai_analysis: improvedAiReasoning,
        
        // Additional nested structure for backward compatibility
        topMatch: {
            decision: aiAnalysis.final_decision || "REVIEW",
            riskLevel: finalRisk,
            reasoning: improvedAiReasoning, // Use improved reasoning here too
            bio: generatedBio || aiAnalysis.bio,
            confidence: bestCandidate.finalScore
        },
        
        analysis: improvedAiReasoning, // Use improved reasoning here too
        timestamp: new Date().toISOString(),
        
        // Performance metrics
        performance: {
            total_time: totalTime,
            db_time: dbTime,
            analysis_time: analysisTime,
            ai_time: aiTime
        }
    };

    // 🆕 ADDED: Phonetic suggestions to main response
    result.phonetic_suggestions = analyzedMatches[0]?.phonetic_variants || [];
    result.ai_analysis = `AI detected variants: ${result.phonetic_suggestions.join(', ')}. ${improvedAiReasoning}`;

    // Debug log to verify bio is in result
    console.log(`📊 Result compiled - Bio included: ${!!result.bio}, AI Analysis included: ${!!result.ai_analysis}`);
    
    // STEP 6: CACHE & LOG
    if (Object.keys(inputDetails).length === 0) searchCache.set(cacheKey, result);
    
    console.log('📝 Attempting audit log for:', cleanInput);
    await logScreeningEvent(cleanInput, userId, ipAddress, result);
    console.log('✅ Audit log saved');

    return result;

  } catch (error) {
    console.error("❌ Screening Error:", error);
    return { error: "Screening Failed", matches: [], message: error.message };
  }
}

module.exports = { screenName, clearCache: () => searchCache.flushAll() };