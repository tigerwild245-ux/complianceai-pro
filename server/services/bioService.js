// server/services/bioService.js
const { getGroqResponse } = require('./groqService');

async function generateBioForPEP(name) {
  const prompt = `
    You are a compliance intelligence assistant. Provide a concise, 2-sentence bio for the following politically exposed person (PEP).
    Focus on their most prominent role and the reason they are internationally recognized.
    Be factual and neutral. Do not include opinions or unverified claims.
    The bio should be suitable for a compliance report.

    PEP Name: "${name}"

    Bio:
  `;

  try {
    const bio = await getGroqResponse(prompt);
    // Clean up potential JSON formatting from the response
    return bio.replace(/^"|"$/g, '').replace(/\\n/g, ' ');
  } catch (error) {
    console.error(`Error generating bio for ${name}:`, error);
    return "Could not generate bio at this time.";
  }
}

module.exports = { generateBioForPEP };
