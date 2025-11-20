// server/services/screeningService.js

const Fuse = require('fuse.js');
const { getGroqResponse } = require('./groqService');
const { normalizeName, getSoundex, getMetaphone } = require('../utils/nameNormalizer');
const { logScreeningEvent } = require('./auditService');
const { isFalsePositive } = require('./falsePositiveService');
const { getSanctionsData, getPepData } = require('./supabaseService'); // Import Supabase retrieval functions
const { generateBioForPEP } = require('./bioService'); // Import bio generation service

let fuse; // Global variable for Fuse instance
let pepList; // Global variable for PEP list
let isInitialized = false;

/**
 * Initializes the screening service by fetching data from Supabase
 * and pre-processing it for Fuse.js.
 */
async function initializeScreeningService() {
  if (isInitialized) return;

  console.log("Initializing screening service: Fetching data from Supabase...");
  const sanctionsData = await getSanctionsData();
  pepList = await getPepData(); // Load PEP data

  if (!sanctionsData || sanctionsData.length === 0) {
    console.error("Failed to load sanctions data from Supabase. Screening will not work.");
    return;
  }

  // --- PRE-PROCESS THE SANCTIONS LIST ---
  // Pre-calculate normalized names, Soundex, and Metaphone for all names/aliases
  const preprocessedSanctionsList = sanctionsData.flatMap(item => 
    item.names.map(name => {
      const normalizedName = normalizeName(name);
      return {
        id: item.id,
        list_type: item.list_type,
        name: name, // The original name/alias
        normalizedName: normalizedName,
        soundex: getSoundex(normalizedName),
        metaphone: getMetaphone(normalizedName),
        designation: item.designation,
        country: item.country,
        full_data: item.full_data,
      };
    })
  );

  // --- CONFIGURE FUSE.JS FOR INITIAL FUZZY SEARCH ---
  const fuseOptions = {
    keys: ['normalizedName'],
    threshold: 0.4, // Slightly looser threshold to catch more potential matches
    includeScore: true,
    findAllMatches: false,
  };

  // Initialize Fuse with the pre-processed list
  fuse = new Fuse(preprocessedSanctionsList, fuseOptions);
  isInitialized = true;
  console.log(`Screening service initialized with ${preprocessedSanctionsList.length} searchable names and ${pepList ? pepList.length : 0} PEPs.`);
}

// --- SCORING CONSTANTS ---
const MAX_SCORE = 100;
const MIN_MATCH_SCORE = 60; // Threshold for a potential match

/**
 * Calculates a base risk score based on fuzzy and phonetic matching.
 * @param {object} inputCodes - Normalized name, soundex, metaphone of the input.
 * @param {object} candidate - The preprocessed sanction list entry.
 * @returns {number} A score between 0 and 100.
 */
function calculateBaseScore(inputCodes, candidate) {
  let score = 0;
  
  // 1. Fuzzy Score (Inverse of Fuse.js score, scaled)
  // Fuse score is 0 (perfect match) to 1 (no match). We invert it.
  // We'll use a fixed high value for the best match found by Fuse.
  // candidate.score is the Fuse score from the search result.
  const fuzzyScore = (1 - candidate.score) * 50; // Max 50 points
  score += fuzzyScore;

  // 2. Phonetic Score (Soundex)
  if (inputCodes.soundex === candidate.soundex) {
    score += 25; // Significant weight for phonetic match
  }

  // 3. Phonetic Score (Metaphone)
  if (inputCodes.metaphone === candidate.metaphone) {
    score += 25; // Significant weight for phonetic match
  }

  // Cap the score at 100
  return Math.min(score, MAX_SCORE);
}

/**
 * Uses Groq to provide a final, intelligent risk assessment and reasoning.
 * @param {string} inputName - The name being screened.
 * @param {object} candidate - The potential match candidate.
 * @param {number} baseScore - The score from the rule-based system.
 * @returns {object} { finalScore, reasoning }
 */
async function groqRiskAssessment(inputName, candidate, baseScore) {
  const prompt = `
    You are a world-class Compliance and Sanctions Manager. Your task is to perform a final risk assessment on a potential sanction match.
    The rule-based system has assigned a base score of ${baseScore}/100.
    
    Input Name: "${inputName}"
    Sanctioned Name: "${candidate.name}"
    Sanction List: ${candidate.list_type}
    Designation: ${candidate.designation}
    
    Based on the names, the base score, and your expert knowledge of name matching (considering common misspellings, transliteration, and cultural naming conventions),
    provide a final risk score (0-100) and a brief, transparent reasoning for the score.
    
    Respond with a JSON object containing three keys: "finalScore", "reasoning", and "matchDecision" ("MATCH", "POTENTIAL", or "NO MATCH").
    
    JSON Response:
  `;

  try {
    const analysis = await getGroqResponse(prompt);
    const jsonMatch = analysis.match(/\{.*\}/s);
    if (jsonMatch) {
      const aiDecision = JSON.parse(jsonMatch[0]);
      return {
        finalScore: parseInt(aiDecision.finalScore, 10) || baseScore,
        reasoning: aiDecision.reasoning || "AI analysis failed to provide reasoning.",
        matchDecision: aiDecision.matchDecision || "POTENTIAL",
      };
    }
  } catch (error) {
    console.error("Error during Groq API call for risk assessment:", error);
  }
  
  // Fallback in case of Groq failure
  return {
    finalScore: baseScore,
    reasoning: `Groq AI failed to respond. Score based on rule-based system: Fuzzy Score (${(baseScore/100)*50} points) + Phonetic Match (${baseScore > 50 ? 'Yes' : 'No'} points).`,
    matchDecision: baseScore >= MIN_MATCH_SCORE ? "POTENTIAL" : "NO MATCH",
  };
}

/**
 * Checks if the input name is a PEP and generates a bio if a match is found.
 * @param {string} inputName - The name being screened.
 * @returns {object|null} PEP match object or null.
 */
async function checkPep(inputName) {
  if (!pepList || pepList.length === 0) return null;

  const normalizedInputName = normalizeName(inputName);
  
  // Simple check against the dummy PEP list for demonstration
  const pepMatch = pepList.find(pep => normalizeName(pep.name) === normalizedInputName);

  if (pepMatch) {
    // Generate bio for the PEP
    const bio = await generateBioForPEP(pepMatch.name);
    return {
      isPep: true,
      name: pepMatch.name,
      country: pepMatch.country,
      role: pepMatch.role,
      bio: bio,
    };
  }

  return null;
}


// --- THE MAIN SCREENING FUNCTION ---
async function screenName(inputName, userId = 'anonymous', ipAddress = '0.0.0.0') {
  // Ensure the service is initialized
  if (!isInitialized) {
    await initializeScreeningService();
    if (!isInitialized) {
      return { matches: [], analysis: "Screening service is not initialized. Data load failed.", riskScore: 0 };
    }
  }

  // 1. Check against the false positive list first
  if (await isFalsePositive(inputName)) {
    const result = { 
      matches: [], 
      analysis: `Input name "${inputName}" is on the false positive list.`,
      riskScore: 0,
    };
    await logScreeningEvent(inputName, userId, ipAddress, result);
    return result;
  }

  // 2. Check for PEP status
  const pepStatus = await checkPep(inputName);
  
  // 3. Pre-process the input name for sanctions screening
  const normalizedInputName = normalizeName(inputName);
  const inputCodes = {
    normalizedName: normalizedInputName,
    soundex: getSoundex(normalizedInputName),
    metaphone: getMetaphone(normalizedInputName),
  };

  // 4. Perform initial fuzzy search to get top candidates
  const fuzzyResults = fuse.search(inputCodes.normalizedName, { limit: 10 });

  // 5. Combine fuzzy and phonetic matches and run Groq assessment
  let potentialMatches = [];
  const processedIds = new Set(); // To ensure we only process each unique sanction entry once

  for (const result of fuzzyResults) {
    const candidate = result.item;
    // Only process the unique sanction entry (id) once
    if (processedIds.has(candidate.id)) continue;
    processedIds.add(candidate.id);

    // Calculate the base score
    candidate.score = result.score; 
    const baseScore = calculateBaseScore(inputCodes, candidate);

    // Only proceed with Groq assessment if the base score is above a minimum threshold
    if (baseScore >= MIN_MATCH_SCORE) {
      const groqResult = await groqRiskAssessment(inputName, candidate, baseScore);
      
      potentialMatches.push({
        id: candidate.id,
        sanctionedName: candidate.name,
        list_type: candidate.list_type,
        designation: candidate.designation,
        country: candidate.country,
        baseScore: baseScore,
        finalScore: groqResult.finalScore,
        reasoning: groqResult.reasoning,
        matchDecision: groqResult.matchDecision,
        full_data: candidate.full_data,
      });
    }
  }
  
  // 6. Sort matches by final score (descending)
  potentialMatches.sort((a, b) => b.finalScore - a.finalScore);

  // 7. Determine final result
  const highestSanctionScore = potentialMatches.length > 0 ? potentialMatches[0].finalScore : 0;
  
  // Adjust overall risk score if PEP is found (e.g., a minimum score of 50 for any PEP)
  const overallRiskScore = Math.max(highestSanctionScore, pepStatus ? 50 : 0);
  
  const finalResult = {
    inputName: inputName,
    riskScore: overallRiskScore,
    analysis: `Screening complete. Highest sanction risk score: ${highestSanctionScore}/100.`,
    pepStatus: pepStatus, // Include PEP status in the final result
    matches: potentialMatches,
  };

  // 8. Log the final event for auditing
  await logScreeningEvent(inputName, userId, ipAddress, finalResult);

  return finalResult;
}

// Export the initialization function to be called on server startup
module.exports = { screenName, initializeScreeningService };
