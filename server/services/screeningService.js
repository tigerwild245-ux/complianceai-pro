// server/services/screeningService.js
const supabase = require('../config/supabaseClient');
const transformerService = require('./transformerService');
const idMatcher = require('../utils/idMatcher');
const { logScreeningEvent } = require('./auditService');
const { analyzeSanctionsMatch } = require('./aiAnalysisService');
const { generateBioForPEP } = require('../services/bioService'); 
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

const calculateMatchScore = async (candidate, inputName, inputDetails) => {
  let matchScore = candidate.similarity_score * 100;
  const analysisLog = [`Fuzzy: ${matchScore.toFixed(1)}%`];
  const candidateFullName = candidate.entity_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim();

  const normalize = (str) => str ? str.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[\u064B-\u065F]/g, '').replace(/[.,\-_]/g, ' ') : '';
  const normalizedInput = normalize(inputName);
  const normalizedCandidate = normalize(candidateFullName);
  const isCrossLanguage = (hasArabic(inputName) && hasLatin(candidateFullName)) || (hasLatin(inputName) && hasArabic(candidateFullName));

  // 1. CONTAINMENT BOOST
  if (normalizedInput.length >= 3 && normalizedCandidate.includes(normalizedInput)) {
    const pattern = new RegExp(`(?:^|\\s)${normalizedInput}(?:\\s|$)`);
    if (pattern.test(normalizedCandidate)) {
      if (matchScore < 60) { matchScore = 60; analysisLog.push('✅ Exact Part-Name Match'); }
      else { matchScore += 10; }
    } else {
      if (matchScore < 40) { matchScore += 15; analysisLog.push('Partial Substring'); }
    }
  }

  // 2. SEMANTIC MATCHING
  const semanticScore = await performSemanticAnalysis(inputName, candidateFullName);
  if (semanticScore !== null && !isNaN(semanticScore)) {
    if (matchScore < 10 && semanticScore > 80) matchScore = semanticScore;
    else matchScore = (matchScore * 0.6) + (semanticScore * 0.4);
    analysisLog.push(`Semantic: ${semanticScore.toFixed(1)}%`);
  }

  // 3. FULL ALIAS MATCHING
  if (candidate.aliases) {
    try {
      let aliasBoost = 0;
      const aliases = Array.isArray(candidate.aliases) ? candidate.aliases : [candidate.aliases];
      
      for (const alias of aliases) {
        const aliasStr = typeof alias === 'object' ? JSON.stringify(alias) : String(alias);
        const normalizedAlias = normalize(aliasStr);
        
        if (normalizedInput === normalizedAlias) {
          aliasBoost = 60;
          analysisLog.push('✅ Alias (Exact)');
          break;
        }
        if (normalizedInput.length >= 3 && normalizedAlias.includes(normalizedInput)) {
           const pattern = new RegExp(`(?:^|\\s)${normalizedInput}(?:\\s|$)`);
           if (pattern.test(normalizedAlias)) aliasBoost = Math.max(aliasBoost, 40);
        }
        if (normalizedAlias.includes(normalizedInput) || normalizedInput.includes(normalizedAlias)) {
           aliasBoost = Math.max(aliasBoost, isCrossLanguage ? 50 : 30);
        }
      }
      
      if (aliasBoost > 0) {
        if (matchScore < 40 && aliasBoost >= 50) { matchScore += aliasBoost; analysisLog.push(`Alias Boost: +${aliasBoost}`); }
        else if (matchScore < 60 && aliasBoost >= 30) { matchScore += (aliasBoost * 0.8); analysisLog.push('Alias Boost'); }
        else if (aliasBoost >= 15) { matchScore += 15; analysisLog.push('✅ Alias'); }
      }
    } catch (err) { console.warn("Alias check failed", err); }
  }

  // 4. PEP BOOST
  if (candidate.is_pep) {
    analysisLog.push(`PEP: ${candidate.pep_level || 'Unknown'}`);
    if ((candidate.pep_level === 'NATIONAL' || candidate.pep_level === 'REGIONAL') && matchScore < 60 && matchScore >= 30) {
       matchScore += 25; analysisLog.push('PEP Boost');
    }
  }

  // 5. EXACT ID MATCHING
  if (inputDetails.passportNumber && candidate.passport_number) {
    if (idMatcher.matchPassport(inputDetails.passportNumber, candidate.passport_number).match) {
      matchScore += 30; analysisLog.push('✅ Passport');
    }
  }
  if (inputDetails.nationalId && candidate.national_id) {
    if (idMatcher.matchNationalId(inputDetails.nationalId, candidate.national_id).match) {
      matchScore += 30; analysisLog.push('✅ NationalID');
    }
  }

  return { finalScore: Math.min(matchScore, 100), analysisLog: analysisLog.join(' | ') };
};

const analyzeMatches = async (potentialMatches, inputName, inputDetails) => {
  const startTime = Date.now();
  const analyzedMatches = await Promise.all(
    potentialMatches.slice(0, MAX_RESULTS_TO_ANALYZE).map(async (candidate) => {
      const { finalScore, analysisLog } = await calculateMatchScore(candidate, inputName, inputDetails);
      return { ...candidate, finalScore, analysisLog };
    })
  );
  analyzedMatches.sort((a, b) => b.finalScore - a.finalScore);
  console.log(`🔬 Analysis complete: ${Date.now() - startTime}ms`);
  return analyzedMatches;
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

const formatMatches = (analyzedMatches) => {
  return analyzedMatches.map(m => ({
    id: m.id,
    name: m.entity_name,
    score: m.finalScore,
    finalScore: m.finalScore, 
    match_score: m.finalScore,
    source: m.list_source,
 program: m.program,
    analysis: m.analysisLog,
    isPEP: m.is_pep,
    // 🛑 NEW: Add a clear match type for easy frontend styling
    match_type: m.is_pep ? 'PEP' : 'SANCTIONS', 
    nationalities: m.nationalities,
    dateOfBirth: m.date_of_birth,
    entity_summary: m.bio || null 
   }));
};

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
    
    // A. GENERATE BIO
    let generatedBio = null;
    if (bestCandidate.is_pep || bestCandidate.finalScore > 75) {
        try {
            generatedBio = await generateBioForPEP(bestCandidate.entity_name, bestCandidate.program);
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

// Prepare the improved AI Assessment Wording (Assuming you applied the previous fix here)
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