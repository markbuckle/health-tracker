const { OpenAI } = require("openai");
require("dotenv").config();

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Function to generate embeddings for a text
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

// Simple test function
async function testEmbedding() {
  const embedding = await generateEmbedding(
    "This is a test sentence for embedding."
  );
  return {
    dimensionCount: embedding.length,
    sample: embedding.slice(0, 5), // Just show the first 5 dimensions
  };
}

// Basic RAG response generation
async function generateBasicResponse(query, context) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content:
            "You are a medical assistant providing information based on the context provided. Only use information from the context.",
        },
        {
          role: "user",
          content: `Context: ${context}\n\nQuestion: ${query}`,
        },
      ],
      temperature: 0.3,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error generating response:", error);
    throw error;
  }
}

module.exports = {
  generateEmbedding,
  testEmbedding,
  generateBasicResponse,
};
