// server/services/groqService.js

const groq = require('groq-sdk');

const client = new groq({ apiKey: process.env.GROQ_API_KEY });

async function getGroqResponse(prompt) {
  const chatCompletion = await client.chat.completions.create({
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
   model: "llama-3.1-8b-instant", // Updated to a current model
      response_format: { type: "json_object" },
    // This is a key addition!
    response_format: { type: "json_object" },
  });

  return chatCompletion.choices[0]?.message?.content || "";
}

module.exports = { getGroqResponse };
