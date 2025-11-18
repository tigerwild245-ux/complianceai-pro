// server/services/screeningService.js

const sanctionsList = require('../data/sanctions.json');
const Fuse = require('fuse.js');
const { getGroqResponse } = require('./groqService');
const { normalizeName } = require('../utils/nameNormalizer');
const { logScreeningEvent } = require('./auditService');
const { isFalsePositive } = require('./falsePositiveService');
// --- NEW: Import the bio service and high-profile list ---
const { generateBioForPEP } = require('./bioService');
const highProfilePEPs = require('../data/highProfilePEPs.json');

// ... (the rest of the file, like normalizedSanctionsList and fuseOptions, remains the same) ...

// --- THE MAIN SCREENING FUNCTION ---
async function screenName(inputName, userId = 'anonymous', ipAddress = '0.0.0.0') {
  // ... (the existing false positive and search logic remains the same) ...

  let result;
  if (searchResults.length === 0 || searchResults[0].score > 0.3) {
    result = { matches: [], analysis: "No potential matches found via fuzzy search." };
  } else {
    const bestCandidate = searchResults[0];
    
    // --- NEW: Check if the matched name is a high-profile PEP ---
    const isHighProfilePEP = highProfilePEPs.includes(bestCandidate.item.name);
    
    const prompt = `
      You are a compliance expert. Compare the following two names.
      Your job is to determine if they refer to the same individual.
      Respond with a JSON object containing two keys: "decision" and "reason".
      The "decision" key must have the value "MATCH" or "NO MATCH".
      The "reason" key should be a very brief explanation.

      Input Name: "${inputName}"
      Sanctioned Name: "${bestCandidate.item.name}"

      JSON Response:
    `;

    try {
      const analysis = await getGroqResponse(prompt);
      let aiDecision;
      try {
        const jsonMatch = analysis.match(/\{.*\}/s);
        if (jsonMatch) {
          aiDecision = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error("No JSON object found in response.");
        }
      } catch (parseError) {
        console.error("Failed to parse Groq JSON response:", analysis);
        result = { matches: [], analysis: "AI response was malformed. Could not determine match." };
      }
      
      if (aiDecision && aiDecision.decision === 'MATCH') {
        const matchDetails = {
          sanctionedName: bestCandidate.item.name,
          score: bestCandidate.score,
          reason: aiDecision.reason,
        };

        // --- NEW: If it's a high-profile PEP, generate and add the bio ---
        if (isHighProfilePEP) {
          matchDetails.bio = await generateBioForPEP(bestCandidate.item.name);
        }
        
        result = {
          matches: [matchDetails],
          analysis: `AI confirmed a match. Reason: ${aiDecision.reason}`
        };
      } else {
        result = {
          matches: [],
          analysis: `AI reviewed the best candidate ("${bestCandidate.item.name}") and determined it was not a match. Reason: ${aiDecision.reason}`
        };
      }
    } catch (error) {
      console.error("Error during Groq API call:", error);
      result = { matches: [], analysis: "An error occurred while contacting the AI service." };
    }
  }

  await logScreeningEvent(inputName, userId, ipAddress, result);
  return result;
}

module.exports = { screenName };
