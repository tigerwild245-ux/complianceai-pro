// server/services/aiAnalysisService.js
const Groq = require('groq-sdk');
const { model: geminiModel } = require('../config/geminiClient');

// Initialize Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GROQ_TIMEOUT = 5000; 

async function analyzeSanctionsMatch(inputName, inputDetails, candidateContext) {
    // SAFEGUARD: Ensure score exists before building prompt
    if (candidateContext.score === undefined || candidateContext.score === null) {
        candidateContext.score = 0;
    }

    const prompt = buildPrompt(inputName, inputDetails, candidateContext);
    
    console.log('🤖 Starting AI analysis...');
    
    // STRATEGY 1: Groq
    const groqResult = await tryGroq(prompt);
    if (groqResult.success) {
        console.log('✅ Groq analysis complete');
        return groqResult.analysis;
    }
    
    console.log('⚠️ Groq failed, trying Gemini fallback...');
    
    // STRATEGY 2: Gemini
    const geminiResult = await tryGemini(prompt);
    if (geminiResult.success) {
        console.log('✅ Gemini analysis complete');
        return geminiResult.analysis;
    }
    
    // STRATEGY 3: Fallback
    return getFallbackAnalysis(candidateContext);
}

async function tryGroq(prompt) {
    if (!process.env.GROQ_API_KEY) return { success: false };

    try {
        const response = await Promise.race([
            groq.chat.completions.create({
                model: GROQ_MODEL,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1,
                max_tokens: 1000,
                response_format: { type: "json_object" } // Force JSON mode if supported
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), GROQ_TIMEOUT))
        ]);

        const jsonText = response.choices[0].message.content.trim();
        // Parse JSON safely
        const analysis = JSON.parse(jsonText.replace(/```json|```/g, ''));
        
        return { success: true, analysis: { ...analysis, ai_provider: 'groq' } };
    } catch (error) {
        console.warn('Groq error:', error.message);
        return { success: false, error: error.message };
    }
}

async function tryGemini(prompt) {
    try {
        // UPDATED SYNTAX: Use the model instance directly
        const result = await geminiModel.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        
        const analysis = JSON.parse(text.replace(/```json|```/g, ''));
        return { success: true, analysis: { ...analysis, ai_provider: 'gemini' } };
    } catch (error) {
        console.warn('Gemini fallback error:', error.message);
        return { success: false, error: error.message };
    }
}

function buildPrompt(inputName, inputDetails, candidateContext) {
    // SAFEGUARD: Handle missing values for display
    const scoreDisplay = (candidateContext.score || 0).toFixed(1);
    const isPep = candidateContext.isPEP ? 'Politically Exposed Person (PEP)' : 'Sanctioned Entity/Individual';
    
    return `You are a **Senior Compliance Officer** performing Enhanced Due Diligence (EDD). Use professional and respectful language, always referring to the subject as 'the subject' or by name, not 'candidate'.
    
MATCH DETAILS:
Subject's Name: "${candidateContext.name}"
Match Type: ${isPep}
Fuzzy Match Score: ${scoreDisplay}/100

TASK: Generate a brief, high-level analysis of the risk.

Respond in JSON:
{
    "risk_level": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    "final_decision": "MATCH" | "FALSE_POSITIVE" | "REQUIRES_REVIEW",
    "reasoning": "Generate a concise, professional assessment. Start by stating the match type (PEP/Sanction) and its risk implication. **Do not use the word 'candidate'.**",
    "bio": "Brief biography of the subject (if possible, otherwise leave blank or state 'N/A').",
    "recommended_action": "Clear" | "Enhanced Due Diligence" | "Reject"
}`;
}

function getFallbackAnalysis(candidateContext) {
    const score = candidateContext.score || 0;
    return {
        risk_level: score > 85 ? "HIGH" : "MEDIUM",
        final_decision: "REQUIRES_REVIEW",
        reasoning: "AI unavailable. Flagged based on rule-based matching.",
        bio: "Profile analysis unavailable.",
        confidence: score,
        ai_provider: 'fallback_rules'
    };
}

module.exports = { analyzeSanctionsMatch };