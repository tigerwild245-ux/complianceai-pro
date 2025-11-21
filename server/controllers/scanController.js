const supabase = require('../config/supabaseClient');
const transformerService = require('./transformerService');
const idMatcher = require('../utils/idMatcher');
const { logScreeningEvent } = require('./auditService');

// --- IMPORTS FOR YOUR NEW ARCHITECTURE ---
const { generateBioForPEP } = require('../services/bioService'); // gemini-2.5-flash (Bio)
const { getGroqResponse } = require('../services/groqService');  // Groq/Llama (Analysis)

async function screenName(inputName, inputDetails = {}, userId = 'anonymous', ipAddress = '0.0.0.0') {
  try {
    // --- STEP 1: DATABASE SEARCH ---
    const { data: potentialMatches, error: dbError } = await supabase
      .rpc('match_sanctions', { query_name: inputName });

    if (dbError) throw new Error(`Database search failed: ${dbError.message}`);

    if (!potentialMatches || potentialMatches.length === 0) {
      const noMatchResult = { 
        match_found: false, 
        matches: [], 
        risk_level: 'low',
        analysis: "No potential matches found in database." 
      };
      await logScreeningEvent(inputName, userId, ipAddress, noMatchResult);
      return noMatchResult;
    }

    // --- STEP 2: TRANSFORMATION + GEMINI BIO INJECTION ---
    // We use Promise.all to fetch Bios in parallel (FAST)
    const formattedMatches = await Promise.all(potentialMatches.slice(0, 10).map(async (m) => {
      
      // Basic Formatting
      const matchObj = {
        name: m.name || m.entity_name || 'Unknown',
        list_type: m.list_source || 'Unknown',
        confidence: m.similarity || m.similarity_score || 0,
        details: m.remarks || '',
        program: m.program || 'N/A',
        nationalities: Array.isArray(m.nationalities) ? m.nationalities.join(', ') : (m.country || 'Not specified'),
        aliases: Array.isArray(m.aliases) ? m.aliases.join(', ') : 'None',
        date_of_birth: m.date_of_birth || 'Unknown',
        place_of_birth: m.place_of_birth || 'Unknown',
        jurisdiction: m.jurisdiction || 'N/A',
        remarks: m.remarks || '',
        is_pep: m.entity_type === 'individual' || m.is_pep === true,
        // Initialize Bio as null
        entity_summary: null 
      };

      // --- GEMINI BIO TRIGGER ---
      // Only call Gemini if confidence is high (> 0.75) to save API calls
      // and provide context (program) to help Gemini identify the right person
      if (matchObj.confidence > 0.75) {
        matchObj.entity_summary = await generateBioForPEP(matchObj.name, matchObj.program);
      }

      return matchObj;
    }));

    // --- STEP 3: DEEP ANALYSIS (Semantic + ID) on Top Candidate ---
    let bestCandidate = formattedMatches[0];
    let matchScore = bestCandidate.confidence * 100; 

    // A. Semantic Boost
    try {
       const semantic = await transformerService.semanticSimilarity(inputName, bestCandidate.name);
       if (semantic && semantic.match) {
          matchScore = (matchScore * 0.7) + (semantic.confidence * 100 * 0.3);
       }
    } catch (e) { console.log("Semantic skip"); }

    // B. ID Boost
    if (inputDetails.passportNumber && bestCandidate.raw_data?.passport_number) {
        const idCheck = idMatcher.matchPassport(inputDetails.passportNumber, bestCandidate.raw_data.passport_number);
        if (idCheck.match) matchScore += 30;
    }

    // --- STEP 4: AI RISK ANALYSIS (GROQ / LLAMA) ---
    // Switched from Gemini to Groq as requested for the heavy reasoning
    let aiAnalysis = null;

    if (matchScore > 50) {
        const prompt = `
          You are a Compliance Officer. Analyze this screening match.
          
          Input Name: "${inputName}"
          Matched Entity: "${bestCandidate.name}"
          Program: "${bestCandidate.program}"
          Score: ${matchScore.toFixed(0)}%
          
          Task: Determine the risk level and explain why.
          Return ONLY a JSON object: { "risk_level": "HIGH"|"MEDIUM"|"LOW", "reasoning": "concise explanation" }
        `;
        
        try {
            // Calling your groqService here
            const text = await getGroqResponse(prompt);
            
            // Parse the JSON from Groq
            const cleanJson = text.replace(/```json|```/g, '').trim();
            aiAnalysis = JSON.parse(cleanJson);
        } catch (err) {
            console.warn("Groq Analysis failed, using fallback", err);
            aiAnalysis = { risk_level: matchScore > 85 ? 'HIGH' : 'MEDIUM', reasoning: "AI Analysis Temporarily Unavailable" };
        }
    }

// --- STEP 5: FINAL RESPONSE ---

    // 1. Calculate Baseline Risk (Using your specific thresholds)
    let calculatedRisk = 'LOW';
    
    if (matchScore >= 96) {
        calculatedRisk = 'CRITICAL';
    } else if (matchScore >= 76) {
        calculatedRisk = 'HIGH';
    } else if (matchScore >= 50) {
        calculatedRisk = 'MEDIUM';
    } else {
        calculatedRisk = 'LOW';
    }

    // 2. Safety Check: Compare with AI Opinion
    // We take the HIGHER of the two. If Math says CRITICAL (100%), 
    // the AI cannot downgrade it to Low.
    const riskSeverity = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
    let finalRisk = calculatedRisk;
    
    if (aiAnalysis && aiAnalysis.risk_level) {
        const aiRiskStr = aiAnalysis.risk_level.toUpperCase();
        // Only change finalRisk if the AI suggests a HIGHER severity than the math
        if (riskSeverity[aiRiskStr] > riskSeverity[calculatedRisk]) {
            finalRisk = aiRiskStr;
        }
    }

    const finalResult = {
      match_found: true,
      matches: formattedMatches, 
      best_match: bestCandidate,
      risk_level: finalRisk, // <--- Now uses the strict logic
      ai_analysis: aiAnalysis,
      timestamp: new Date().toISOString()
    };

    await logScreeningEvent(inputName, userId, ipAddress, finalResult);
    return finalResult;

  } catch (error) {
    console.error("Screening Service Error:", error);
    return { error: "Screening Failed", matches: [] };
  }
}
module.exports = { screenName };