/**
 * Transformer-based AI Analysis
 * REFACTORED: Switched from Hugging Face (Unstable/410 errors) to Google Gemini (Stable)
 * For semantic similarity and entity recognition
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

class TransformerService {
  constructor() {
    // Initialize Gemini Client
    // Ensure GEMINI_API_KEY is in your .env file
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("⚠️ GEMINI_API_KEY is missing. Transformer service will not function.");
    }
    
    this.genAI = new GoogleGenerativeAI(apiKey);
    
    // Use Google's latest embedding model (High performance, low latency)
    this.embeddingModel = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
  }

  /**
   * Named Entity Recognition (Simulated via Gemini)
   * Note: For high volume, Regex is faster, but this is more accurate.
   */
  async extractEntities(text) {
    if (!text) return { persons: [], organizations: [], locations: [] };

    try {
      const model = this.genAI.getGenerativeModel({ 
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash" 
});
      const prompt = `Extract entities from this text: "${text}". 
      Return JSON only with keys: persons (array), organizations (array), locations (array).`;
      
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonText = responseText.replace(/```json|```/g, '').trim();
      
      return JSON.parse(jsonText);
    } catch (error) {
      console.error('NER error:', error.message);
      return { persons: [], organizations: [], locations: [] };
    }
  }

  /**
   * Generate embeddings using Google Gemini
   * Replaces the Hugging Face call that was causing 410 errors
   */
  async generateEmbedding(text) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
          return null;
      }

      // Clean newlines which can sometimes affect embeddings
      const cleanText = text.replace(/\n/g, " ");

      const result = await this.embeddingModel.embedContent(cleanText);
      const embedding = result.embedding;
      
      return embedding.values; // Returns array of numbers
    } catch (error) {
      // Suppress 410/404 logs to avoid clutter, just warn
      console.warn(`⚠️ Embedding generation failed for text "${text.substring(0, 20)}...": ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate cosine similarity between embeddings
   * 
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }

    magA = Math.sqrt(magA);
    magB = Math.sqrt(magB);

    if (magA === 0 || magB === 0) return 0;
    
    return dotProduct / (magA * magB);
  }

  /**
   * Semantic similarity between two texts
   * This is the main function called by your screeningService
   */
  async semanticSimilarity(text1, text2) {
    try {
      // Run embeddings in parallel for speed
      const [emb1, emb2] = await Promise.all([
        this.generateEmbedding(text1),
        this.generateEmbedding(text2)
      ]);

      if (!emb1 || !emb2) {
          return { similarity: 0, match: false, confidence: 0 };
      }

      const similarity = this.cosineSimilarity(emb1, emb2);
      
      return {
        similarity,
        match: similarity > 0.80, // Slightly higher threshold for Gemini (it's more precise)
        confidence: similarity // Used by screeningService for math calculations
      };
    } catch (error) {
      console.error('Semantic similarity error:', error.message);
      return { similarity: 0, match: false, confidence: 0 };
    }
  }
}

// Export a singleton instance
module.exports = new TransformerService();