// server/services/bioService.js
const { model } = require('../config/geminiClient');

async function generateBioForPEP(name, contextInfo = "", variants = []) {
  if (!name) return null;
  
  const variantStr = variants.length ? ` (variants: ${variants.join(', ')})` : '';
  const prompt = `Create factual 1-2 sentence profile for "${name}"${variantStr}. ${contextInfo}.

Guidelines:
1. If PEP/President/Minister: State position + country.
2. If sanctioned: Include reason.
3. If unsure: Output "Identity profile not verified."
4. Output PLAIN TEXT only. No Markdown, no quotes.`;

  try {
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