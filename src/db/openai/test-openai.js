const openaiService = require("./openaiService");

async function testOpenAI() {
  try {
    const result = await openaiService.testEmbedding();
    console.log("OpenAI embedding test successful!");
    console.log("Embedding dimension count:", result.dimensionCount);
    console.log("Sample of embedding vector:", result.sample);
  } catch (error) {
    console.error("OpenAI embedding test failed:", error);
    console.error(
      "Make sure your OPENAI_API_KEY is set correctly in .env file"
    );
  }
}

testOpenAI();
