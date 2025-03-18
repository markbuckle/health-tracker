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
  
  Give a clear, direct answer without any commentary. Format your response as plain text with no special formatting. [/INST]</s>`,
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

    // Extract the generated text
    const fullText = result[0]?.generated_text || "";

    // Split the text to get only the response part
    let answer = "";
    const parts = fullText.split("[/INST]");
    if (parts.length > 1) {
      // Get the raw answer after [/INST]
      const rawAnswer = parts[1]
        .replace(/\s*<\/s>\s*$/, "") // Remove closing </s> tag
        .replace(/^\s*<\/s>\s*/, "") // Remove opening </s> tag if present
        .trim();

      // Look for the true start of the answer
      // This targets finding the first proper sentence in the text
      const sentenceMatch = rawAnswer.match(/[A-Z][^.!?]*[.!?]/);
      if (sentenceMatch) {
        // Get the index where the first proper sentence starts
        const startIndex = rawAnswer.indexOf(sentenceMatch[0]);
        if (startIndex > 0) {
          // If it's not at the beginning, take everything from this point
          answer = rawAnswer.substring(startIndex);
        } else {
          answer = rawAnswer;
        }
      } else {
        // If no clear sentence is found, try to clean up by removing non-alphanumeric prefixes
        answer = rawAnswer.replace(/^[^a-zA-Z0-9\s]+/, "").trim();

        // Also check for common prefixes that appear in the output
        const commonPrefixes = ["IB.", "力IB.", "BIB.", "BL", "B ", "I ", "L "];
        for (const prefix of commonPrefixes) {
          if (answer.startsWith(prefix)) {
            answer = answer.substring(prefix.length).trim();
            break;
          }
        }
      }
    } else {
      // If we can't split by [/INST], just use a more basic approach
      answer = fullText
        .replace(/\s*<\/s>\s*$/, "")
        .replace(/^\s*<\/s>\s*/, "")
        .replace(/^[^a-zA-Z0-9\s]+/, "")
        .trim();
    }

    // Final cleanup - remove any remaining non-printable characters and normalize whitespace
    answer = answer
      .replace(/[\x00-\x1F\x7F-\x9F]/g, "") // Remove control characters
      .replace(/\s{2,}/g, " ") // Normalize whitespace
      .trim();

    // Final check for known prefixes that might remain
    if (
      answer.startsWith("IB.") ||
      answer.startsWith("LB.") ||
      answer.startsWith("BI.") ||
      answer.startsWith("BL.")
    ) {
      answer = answer.substring(3).trim();
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
