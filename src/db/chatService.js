const { OpenAI } = require("openai");
const fetch = require("node-fetch"); // Hugging Face library
// const Anthropic = require("@anthropic-ai/sdk");
require("dotenv").config({ path: "../../.env" });

// Initialize the clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Import Together patterns
let Together;
try {
  Together = require('together-ai').Together;
  if (!Together) {
    Together = require('together-ai').default;
  }
  if (!Together) {
    Together = require('together-ai');
  }
} catch (error) {
  console.error('Together AI import failed:', error.message);
}

const together = new Together({
  apiKey: process.env.TOGETHER_API_KEY,
});

console.log("OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);
console.log("TOGETHER_API_KEY present:", !!process.env.TOGETHER_API_KEY);

// Initialize with your Hugging Face API token
// const HF_API_TOKEN = process.env.HF_API_TOKEN;

// Initialize the Anthropic client
// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY, // You'll need to get this from Anthropic
// });

// console.log("OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);
// console.log("HF_API_TOKEN present:", !!process.env.HF_API_TOKEN);
// console.log("ANTHROPIC_API_KEY present:", !!process.env.ANTHROPIC_API_KEY);

// Simple post-processing function that removes known hallucinations
function cleanResponse(response) {
  return (
    response
      .replace(
        /^(Axir|According to the provided documents,|Based on the context,|In the provided documents,|The documents state that|As mentioned in the documents,|As mentioned in the documents,|IntroductionIn the provided documents,|Original---------------inois a medical professional and according to the documents provided by Peter Attia MD,)\s*/i,
        ""
      )
      // Remove document references
      .replace(/Document \d+[:\-]\s*/gi, "")
      .replace(/\(Episode \d+[^)]*\)/gi, "")
      .replace(/Source:\s*[^,\n]*(,|\n|$)/gi, "")
      .replace(/Episode \d+[^:]*:\s*/gi, "")
      // Remove section headers like "I. Introduction", "II. Definition", etc.
      .replace(/^[IVX]+\.\s*[A-Za-z]+\s*\n?/gm, "")
      // Remove unnecessary line breaks at the beginning
      .replace(/^\n+/, "")
      // Remove any markdown-style headers
      .replace(/^#+\s+.+$/gm, "")
      // Clean up any "Introduction:" or similar prefixes
      .replace(/^(Introduction:|Overview:|Summary:|Background:)\s*/i, "")
      .trim()
  );
}

// Function to format context in a more structured way
function formatContext(context) {
  // Split the context into individual documents
  const documents = context.split("\n\n").filter((doc) => doc.trim());

  // Format each document with clear separators and titles
  return documents
    .map((doc, index) => {
      // Try to extract a title if available
      // const titleMatch = doc.match(/Title:\s*(.*?)\s*\n/);
      // const title = titleMatch ? titleMatch[1] : `Document ${index + 1}`;

      // Format the content
      const content = doc.replace(/Title:\s*.*?\s*\n/, "").trim();
      // return `DOCUMENT ${index + 1}: "${title}"\n${content}\n---`;
      return content;
    })
    .join("\n\n");
}

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

// Function to check if Together AI is working
async function checkTogetherAIStatus() {
  try {
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'meta-llama/Llama-3-8b-chat-hf',  // Better at following instructions
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
        temperature: 0.1
      })
    });

    if (response.ok) {
      const result = await response.json();
      return {
        working: true,
        model: 'mistralai/Mistral-7B-Instruct-v0.1',
        response: result.choices[0].message.content
      };
    } else {
      const error = await response.text();
      return { working: false, error: `HTTP ${response.status}: ${error}` };
    }
  } catch (error) {
    return { 
      working: false, 
      error: error.message 
    };
  }
}

// Update your generateBasicResponse function to handle userContext
async function generateBasicResponse(query, context, userContext = null) {
  try {
    console.log("Generating response with Together AI...");
    console.log("Context length:", context.length, "characters");
    console.log("User context provided:", !!userContext);

    // Check if this is a direct question about user's personal information
    const isPersonalQuestion = query.toLowerCase().includes('my blood type') || 
                              query.toLowerCase().includes('what is my') ||
                              query.toLowerCase().includes('what is the user') ||
                              query.toLowerCase().includes('blood type');

    console.log("Is personal question:", isPersonalQuestion);

    if (userContext && isPersonalQuestion) {
      // For personal questions, answer DIRECTLY from user data without medical documents
      console.log("🎯 Handling personal question with direct user data");
      
      const response = await fetch('https://api.together.xyz/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'mistralai/Mistral-7B-Instruct-v0.1',
          messages: [
            {
              role: 'system',
              content: 'You are a medical assistant. Answer questions directly based on the patient information provided. Do not reference any documents.'
            },
            {
              role: 'user', 
              content: `Patient Information:
- Name: Mark Buckle
- Age: ${userContext.profile?.age || 'Not specified'}
- Sex: ${userContext.profile?.sex || 'Not specified'}  
- Blood Type: ${userContext.profile?.bloodType || 'Not specified'}
- Current Medications: ${userContext.profile?.medications?.filter(m => m).join(', ') || 'None'}

Question: ${query}

Answer directly based on the patient information above. Be specific and concise.`
            }
          ],
          max_tokens: 50, // Very short response
          temperature: 0.1,
          top_p: 0.9
        })
      });

      if (response.ok) {
        const result = await response.json();
        const answer = result.choices[0].message.content;
        console.log("✅ Direct personal response:", answer);
        return cleanResponse(answer);
      }
    }

    // For non-personal questions, use the existing logic
    console.log("📚 Handling general medical question");
    
    // Format the context in a more structured way
    const formattedContext = formatContext(context);
    
    let userPrompt = `Read through these medical documents carefully and answer the question based on what you find:

${formattedContext}`;

    if (userContext) {
      userPrompt += `

PATIENT CONTEXT (use if relevant):
- Age: ${userContext.profile?.age}, Sex: ${userContext.profile?.sex}
- Blood Type: ${userContext.profile?.bloodType}`;
    }

    userPrompt += `

Question: ${query}

Instructions:
- Search through ALL the document content for information related to the question
- Use the patient context when relevant to provide personalized answers
- Provide a comprehensive but CONCISE answer (maximum 100 words)
- Be specific and detailed but brief`;

    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistralai/Mistral-7B-Instruct-v0.1',
        messages: [
          {
            role: 'system',
            content: 'You are a medical research assistant. Provide information based on the context provided and any provided patient information.'
          },
          {
            role: 'user', 
            content: userPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3,
        top_p: 0.9,
        repetition_penalty: 1.1
      })
    });

    console.log("Together AI response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Together AI API error: ${response.status} ${response.statusText}`);
      return `Error: Together AI API returned ${response.status}`;
    }

    const result = await response.json();
    const answer = result.choices[0].message.content;

    if (!answer) {
      return "No response could be generated. Please try again later.";
    }

    console.log("Answer generated:", answer.substring(0, 100) + "...");
    return cleanResponse(answer);

  } catch (error) {
    console.error("Error generating response with Together AI:", error);
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
      model: "mistralai/Mistral-7B-Instruct-v0.1 (Together AI)",
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
  cleanResponse,
  generateEmbedding,
  generateBasicResponse,
  testModel,
  checkTogetherAIStatus
};
