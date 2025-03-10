// test-models.js
const { OpenAI } = require("openai");
require("dotenv").config();

async function listModels() {
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    const models = await openai.models.list();
    console.log("Models available to your API key:");
    models.data.forEach((model) => {
      console.log(`- ${model.id}`);
    });
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
