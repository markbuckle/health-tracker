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
    console.log("🚨 UPDATED generateBasicResponse called with query:", query);
    console.log("🚨 UserContext provided:", !!userContext);
    
    // Check if this is a direct question about user's personal information
    const personalQuestionPatterns = [
      'my blood type', 'what is my', 'what is the user', 'blood type',
      'how old am i', 'my age', 'what age am i', 'how old is the user',
      'my sex', 'my gender', 'what sex am i', 'what gender am i',
      'my medications', 'what medications', 'my meds', 'what meds',
      'my family history', 'family history', 'my lifestyle', 'my health history',
      'my lab values', 'my lab results', 'my recent labs', 'my test results'
    ];
    
    const queryLower = query.toLowerCase();
    const isPersonalQuestion = personalQuestionPatterns.some(pattern => 
      queryLower.includes(pattern)
    );

    console.log("Is personal question:", isPersonalQuestion);

    if (userContext && isPersonalQuestion) {
  // For personal questions, answer DIRECTLY from user data without medical documents
  console.log("🎯 Handling personal question with direct user data");
  
  // Format family history details
  let familyHistoryText = 'No family history recorded';
  if (userContext.profile?.familyHistoryDetails && userContext.profile.familyHistoryDetails.length > 0) {
    familyHistoryText = userContext.profile.familyHistoryDetails
      .map(item => `${item.condition} (affects: ${item.relatives}, notes: ${item.notes})`)
      .join('; ');
  }
  
  // Format lifestyle details
  let lifestyleText = 'No lifestyle information recorded';
  if (userContext.profile?.lifestyleDetails && userContext.profile.lifestyleDetails.length > 0) {
    lifestyleText = userContext.profile.lifestyleDetails
      .map(item => `${item.habitType} (status: ${item.status}, notes: ${item.notes})`)
      .join('; ');
  }
  
  // Format medication details
  let medicationsText = 'No medications or supplements recorded';
  if (userContext.profile?.medicationDetails && userContext.profile.medicationDetails.length > 0) {
    medicationsText = userContext.profile.medicationDetails
      .map(item => `${item.name} (${item.type}, ${item.dosage}, ${item.frequency})`)
      .join('; ');
  }
  
  // Format monitoring details
  let monitoringText = 'No monitoring data recorded';
  if (userContext.profile?.monitoringDetails && userContext.profile.monitoringDetails.length > 0) {
    const monitoring = userContext.profile.monitoringDetails[0]; // Get most recent
    monitoringText = `Weight: ${monitoring.weight}, Blood Pressure: ${monitoring.bloodPressure}, Heart Rate: ${monitoring.restingHeartRate}, Sleep: ${monitoring.sleep}`;
  }
  
  // Format recent lab values
  let labValuesText = 'No recent lab values available';
  if (userContext.recentLabValues && Object.keys(userContext.recentLabValues).length > 0) {
    const labEntries = Object.entries(userContext.recentLabValues)
      .slice(0, 5)
      .map(([test, data]) => `${test}: ${data.value} ${data.unit || ''} (${new Date(data.date).toLocaleDateString()})`)
      .join(', ');
    labValuesText = labEntries;
  }
  
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
          content: 'You are a medical assistant. Answer questions directly and clearly based on the patient information provided. If the patient has specific health information, state it clearly. Be specific and helpful.'
        },
        {
          role: 'user', 
          content: `PATIENT HEALTH INFORMATION FOR MARK BUCKLE:

BASIC INFO:
- Age: ${userContext.profile?.age || 'Not specified'} years old
- Sex: ${userContext.profile?.sex || 'Not specified'}  
- Blood Type: ${userContext.profile?.bloodType || 'Not specified'}

FAMILY HISTORY:
${familyHistoryText}

LIFESTYLE:
${lifestyleText}

MEDICATIONS & SUPPLEMENTS:
${medicationsText}

CURRENT MONITORING DATA:
${monitoringText}

RECENT LAB VALUES:
${labValuesText}

Question: ${query}

Answer this question directly using the patient information above. Be specific and comprehensive.`
        }
      ],
      max_tokens: 150,
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

    // ... rest of your existing function for non-personal questions
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
