// server/config/geminiClient.js
require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

const geminiApiKey = process.env.GEMINI_API_KEY;

if (!geminiApiKey) {
  throw new Error('GEMINI_API_KEY is not set. Please add it to your server/.env file.');
}

// Initialize the Gemini AI client
const ai = new GoogleGenAI({ apiKey: geminiApiKey });

// Use Gemini 1.5 Flash for speed and cost-effectiveness
const model = "gemini-1.5-flash"; 

module.exports = { ai, model };