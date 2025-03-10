const { OpenAI } = require("openai");
const fetch = require("node-fetch"); // Hugging Face library
// const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config({ path: "../../.env" });

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize with your Hugging Face API token
const HF_API_TOKEN = process.env.HF_API_TOKEN;

// Initialize the Anthropic client
// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY, // You'll need to get this from Anthropic
// });

// console.log("OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);
// console.log("HF_API_TOKEN present:", !!process.env.HF_API_TOKEN);
// console.log("ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);

// Function to generate embeddings for a text
async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      // model: "text-embedding-3-small",
      input: text,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw error;
  }
}

// Function to generate a response using Hugging Face
async function generateBasicResponse(query, context) {
  try {
    console.log("Generating response with Hugging Face...");
    console.log("Context length:", context.length, "characters");

    const response = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${HF_API_TOKEN}`,
        },
        body: JSON.stringify({
          inputs: `<s>[INST] You are a professional medical assistant providing concise, factual information. 
  Answer the question directly based ONLY on the following context information:
  
  ${context}
  
  Question: ${query}
  
  Give a clear, direct answer without any commentary about "sleeping on the question" or similar phrases. [/INST]</s>`,
        }),
      }
    );

    console.log("Response status:", response.status);

    const responseText = await response.text();
    console.log(
      "Raw response first 200 chars:",
      responseText.substring(0, 200) + "..."
    );

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("Failed to parse JSON response:", e);
      return "Error: Could not parse response from Hugging Face API";
    }

    // Extract just the answer part using a more robust approach
    const fullText = result[0]?.generated_text || "";

    // Better extraction - look for the pattern after [/INST] and remove any </s> tags
    let answer = "";
    const parts = fullText.split("[/INST]");
    if (parts.length > 1) {
      answer = parts[1]
        .replace(/\s*<\/s>\s*$/, "")
        .replace(/^\s*<\/s>\s*/, "")
        .trim();
    } else {
      answer = fullText
        .replace(/\s*<\/s>\s*$/, "")
        .replace(/^\s*<\/s>\s*/, "")
        .trim();
    }

    if (!answer) {
      console.log("No answer extracted from response");
      return "No response could be generated. Please try again later.";
    }

    console.log(
      "Extracted answer first 100 chars:",
      answer.substring(0, 100) + "..."
    );
    return answer;
  } catch (error) {
    console.error("Error generating response with Hugging Face:", error);
    return "Error processing your request: " + error.message;
  }
}

// Function to generate a response using Claude
// async function generateBasicResponse(query, context) {
//   try {
//     const message = await anthropic.messages.create({
//       model: "claude-3-haiku-20240307", // Cheapest model, good for testing
//       //   model: "claude-3-opus-20240229", // More powerful model, but more expensive
//       max_tokens: 500,
//       messages: [
//         {
//           role: "user",
//           content: `Context: ${context}\n\nQuestion: ${query}\n\nPlease answer the question based only on the provided context.`,
//         },
//       ],
//       temperature: 0.3,
//     });

//     return message.content[0].text;
//   } catch (error) {
//     console.error("Error generating response with Claude:", error);
//     throw error;
//   }
// }

// Simple test function
async function testModel() {
  try {
    const response = await generateBasicResponse(
      "What is a healthy cholesterol level?",
      "LDL cholesterol levels below 100 mg/dL are considered optimal. Levels between 100-129 mg/dL are considered near optimal. Total cholesterol levels below 200 mg/dL are considered desirable."
    );

    return {
      model: "mistralai/Mistral-7B-Instruct-v0.2",
      // model: "claude-3-haiku-20240307",
      response: response,
    };
  } catch (error) {
    console.error("Test failed:", error);
    return {
      error: error.message,
    };
  }
}

module.exports = {
  generateEmbedding,
  generateBasicResponse,
  testModel,
};
