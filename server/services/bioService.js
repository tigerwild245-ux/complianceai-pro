// server/services/bioService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🛑 FIX: Use the specific version tag "gemini-1.5-flash-001" to resolve the 404 error
// If this still fails in your specific region, change this string to "gemini-pro"
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

/**
 * Generates a richer 3-line biography for a given entity.
 */
async function generateBioForPEP(name, program) {
  if (!name) return null;

  try {
    // Enhanced Prompt for 3-line detailed bio
    const prompt = `
    Role: Expert Compliance Analyst.
    Task: Write a detailed identity profile for the subject: "${name}".
    Context: The subject is flagged under the program: "${program}".

    Requirements:
    1. Length: Write exactly 2 to 3 complete, detailed sentences (approx. 50-60 words).
    2. Content: 
       - Sentence 1: Identify their current primary role, position, or title.
       - Sentence 2: Mention their nationality and a key historical role or affiliation.
       - Sentence 3: Briefly state the context of their political exposure or sanction status.
    3. Style: Professional, factual, and objective. No bullet points. Plain text only.
    
    Output the biography only.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Basic cleanup to remove markdown bolding if AI adds it
    return text.replace(/\*\*/g, '').trim();

  } catch (error) {
    // Log the specific error to help with debugging
    console.warn(`⚠️ Gemini Bio Generation Failed for ${name}:`, error.message);
    return null; // Return null so the UI handles it gracefully without crashing
  }
}

module.exports = { generateBioForPEP };