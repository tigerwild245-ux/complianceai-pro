// server/config/geminiClient.js
require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("⚠️  GEMINI_API_KEY is missing in .env file");
}

// Initialize and export the model instance
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ 
  model: process.env.GEMINI_MODEL || "gemini-2.5-flash" 
});

module.exports = { 
  GoogleGenerativeAI, 
  apiKey,
  model  // Export the model instance
};
