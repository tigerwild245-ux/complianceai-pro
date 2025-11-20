// server/services/bioService.js

const { getGroqResponse } = require('./groqService');

async function generateBioForPEP(name) {
  try {
    const chatCompletion = await client.chat.completions.create({
      messages: [
        {
          // --- THIS IS THE CORRECT PLACE FOR INSTRUCTIONS ---
          role: "system",
          content: "You are a compliance intelligence assistant. You must respond with a valid JSON object containing a single key 'bio'. The value of 'bio' should be a concise, 2-sentence summary. Do not include any other text or explanations outside of the JSON object."
        },
        {
          role: "user",
          // --- THE USER PROMPT IS NOW SIMPLE ---
          content: `Provide a concise, 2-sentence bio for the following politically exposed person (PEP): ${name}.`
        },
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    });

    return chatCompletion.choices[0]?.message?.content || "";
  } catch (error) {
    console.error(`Error generating bio for ${name}:`, error);
    return "Could not generate bio.";
  }
}

module.exports = { generateBioForPEP };