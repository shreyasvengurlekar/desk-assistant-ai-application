const { GoogleGenAI } = require("@google/genai");

async function askGemini(apiKey, prompt) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  });
  return response.text;
}

module.exports = { askGemini };
