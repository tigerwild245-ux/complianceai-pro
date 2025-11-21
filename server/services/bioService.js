// server/services/bioService.js
const { model } = require('../config/geminiClient');

async function generateBioForPEP(name, contextInfo = "") {
  if (!name) return null;
  
  try {
    console.log(`📝 Generating bio for: ${name}`);

    const prompt = `Task: Write a strictly factual, 2-sentence biography about "${name}" ${contextInfo ? `(${contextInfo})` : ''}.
Guidelines:
1. Identify who they are (e.g., "Prime Minister of Egypt").
2. If unsure, output: "Identity profile not verified."
3. Output PLAIN TEXT only. No Markdown.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const bio = response.text();

    console.log(`✅ Bio generated: ${bio.substring(0, 50)}...`);
    return bio ? bio.replace(/^"|"$/g, '').trim() : "Profile unavailable.";

  } catch (error) {
    console.error(`⚠️ Bio generation failed for ${name}:`, error.message);
    return `${name} - Profile information unavailable. Please verify identity manually.`;
  }
}

module.exports = { generateBioForPEP };
