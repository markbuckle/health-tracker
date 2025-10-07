// src/db/chatService.js - FIXED: Separate Personal vs General Questions
const { OpenAI } = require("openai");
const fetch = require("node-fetch");
require("dotenv").config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

console.log("OPENAI_API_KEY present:", !!process.env.OPENAI_API_KEY);
console.log("TOGETHER_API_KEY present:", !!process.env.TOGETHER_API_KEY);

// ============================================
// RESPONSE CLEANING
// ============================================

function cleanResponse(response) {
  return (
    response
      // Remove Question/Answer prefixes
      .replace(/^Question:.*?\n+/i, '')
      .replace(/^Answer:\s*/i, '')
      // Remove common LLM prefixes
      .replace(
        /^(Axir|According to the provided documents,|Based on the context,|In the provided documents,|The documents state that|As mentioned in the documents,|The context shows that|IntroductionIn the provided documents,)\s*/i,
        ""
      )
      // Remove document reference markers
      .replace(/Document \d+[:\-]\s*/gi, "")
      .replace(/\(Episode \d+[^)]*\)/gi, "")
      .replace(/Source:\s*[^,\n]*(,|\n|$)/gi, "")
      .replace(/Episode \d+[^:]*:\s*/gi, "")
      // Remove auto-generated section markers
      .replace(/^[IVX]+\.\s*[A-Za-z]+\s*\n?/gm, "")
      // Clean up intro phrases
      .replace(/^(Introduction:|Overview:|Summary:|Background:)\s*/i, "")
      // Remove markdown headers (## Header becomes just Header)
      .replace(/^#{1,6}\s+(.+)$/gm, '$1')
      // Clean up excess whitespace
      .replace(/^\n+/, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

function formatContext(context) {
  if (!context) return "";
  const documents = context.split("\n\n").filter((doc) => doc.trim());
  return documents
    .map((doc) => doc.replace(/Title:\s*.*?\s*\n/, "").trim())
    .join("\n\n");
}

// ============================================
// EMBEDDINGS
// ============================================

async function generateEmbedding(text) {
  try {
    console.log('🔮 Generating embedding for text length:', text.length);
    
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    });

    console.log('✅ Embedding generated successfully');
    return response.data[0].embedding;
  } catch (error) {
    console.error("❌ Error generating embedding:", error.message);
    if (error.code === 'invalid_api_key') {
      throw new Error('Invalid OpenAI API key. Please check your OPENAI_API_KEY in .env file.');
    } else if (error.code === 'quota_exceeded') {
      throw new Error('OpenAI API quota exceeded. Please check your billing.');
    } else {
      throw new Error(`OpenAI embedding error: ${error.message}`);
    }
  }
}

// ============================================
// PERSONAL QUESTION DETECTION
// ============================================

function isPersonalHealthQuestion(query) {
  const patterns = [
    /\bmy blood type\b/i,
    /\bwhat is my\b/i,
    /\bhow old am i\b/i,
    /\bmy age\b/i,
    /\bmy sex\b/i,
    /\bmy gender\b/i,
    /\bmy medications?\b/i,
    /\bmy meds\b/i,
    /\bmy lifestyle\b/i,
    /\bmy lab (values?|results?)\b/i,
    /\bmy (cholesterol|ldl|hdl|triglycerides)\b/i,
    /\bmy blood pressure\b/i,
    /\bmy weight\b/i,
    /\bwhat are my\b/i,
    /\bshow me my\b/i,
    /\bmy family history\b/i,
    /\bmy health history\b/i,
    /\bmy test results\b/i
  ];
  
  return patterns.some(pattern => pattern.test(query));
}

// ============================================
// TOGETHER AI STATUS CHECK
// ============================================

async function checkTogetherAIStatus() {
  try {
    const response = await fetch('https://api.together.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'mistralai/Mistral-7B-Instruct-v0.1',
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
    return { working: false, error: error.message };
  }
}

// ============================================
// MAIN RESPONSE GENERATION
// ============================================

async function generateBasicResponse(query, context, userContext = null) {
  try {
    console.log("\n🤖 GenerateBasicResponse called");
    console.log("📝 Query:", query);
    console.log("📄 Context length:", context?.length || 0);
    console.log("👤 UserContext provided:", !!userContext);

    // Parse userContext if it's a string
    let parsedUserContext = userContext;
    if (typeof userContext === 'string') {
      try {
        parsedUserContext = JSON.parse(userContext);
        console.log("✅ Parsed userContext from string");
      } catch (e) {
        console.error("❌ Failed to parse userContext:", e);
        parsedUserContext = null;
      }
    }

    // Check if this is a personal question
    const queryLower = query.toLowerCase();
    const isPersonalQuestion = isPersonalHealthQuestion(query);

    console.log("🔍 Is personal question:", isPersonalQuestion);
    console.log("🔍 Has parsed user context:", !!parsedUserContext);

    // ==========================================
    // HANDLE PERSONAL QUESTIONS (with user context)
    // ==========================================
    if (parsedUserContext && isPersonalQuestion) {
      console.log("🎯 Handling personal question with direct user data");
      
      // Format family history details
      let familyHistoryText = 'No family history recorded';
      if (parsedUserContext.profile?.familyHistoryDetails && parsedUserContext.profile.familyHistoryDetails.length > 0) {
        familyHistoryText = parsedUserContext.profile.familyHistoryDetails
          .map(item => `${item.condition} (affects: ${item.relatives?.join(', ')}, notes: ${item.notes})`)
          .join('; ');
      }
      
      // Format personal history details
      let personalHistoryText = 'No personal medical history recorded';
      if (parsedUserContext.profile?.personalHistoryDetails && parsedUserContext.profile.personalHistoryDetails.length > 0) {
        personalHistoryText = parsedUserContext.profile.personalHistoryDetails
          .map(item => `${item.condition} (notes: ${item.notes})`)
          .join('; ');
      }
      
      // Format lifestyle details
      let lifestyleText = 'No lifestyle information recorded';
      if (parsedUserContext.profile?.lifestyleDetails && parsedUserContext.profile.lifestyleDetails.length > 0) {
        lifestyleText = parsedUserContext.profile.lifestyleDetails
          .map(item => `${item.habitType} (status: ${item.status?.join(', ')}, notes: ${item.notes})`)
          .join('; ');
      }
      
      // Format medication details
      let medicationsText = 'No medications or supplements recorded';
      if (parsedUserContext.profile?.medicationDetails && parsedUserContext.profile.medicationDetails.length > 0) {
        medicationsText = parsedUserContext.profile.medicationDetails
          .map(item => `${item.name} (${item.type}, ${item.dosage}, ${item.frequency})`)
          .join('; ');
      }
      
      // Format monitoring details
      let monitoringText = 'No monitoring data recorded';
      if (parsedUserContext.profile?.monitoringDetails && parsedUserContext.profile.monitoringDetails.length > 0) {
        const latest = parsedUserContext.profile.monitoringDetails[0];
        monitoringText = `Weight: ${latest.weight}, Blood Pressure: ${latest.bloodPressure}, Resting Heart Rate: ${latest.restingHeartRate}, Sleep: ${latest.sleep}`;
      }
      
      // Format recent lab values
      let labValuesText = 'No recent lab values recorded';
      if (parsedUserContext.recentLabValues && Object.keys(parsedUserContext.recentLabValues).length > 0) {
        labValuesText = Object.entries(parsedUserContext.recentLabValues)
          .map(([test, data]) => `${test}: ${data.value} ${data.unit} (reference: ${data.referenceRange})`)
          .join('; ');
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
              content: `You are Reed, a personal health assistant. Answer questions using the user's personal health data provided.

CRITICAL RULES:
1. Answer directly using the User's Personal Data
2. Be specific with numbers and values from their data
3. Keep responses concise and actionable
4. If asked about specific values, provide them clearly
5. If data is missing or says "Not specified", say "I don't have that information in your profile"
6. Do not make up information not in the user data`
            },
            {
              role: 'user',
              content: `PATIENT HEALTH INFORMATION:

BASIC INFO:
- Age: ${parsedUserContext.profile?.age || 'Not specified'} years old
- Sex: ${parsedUserContext.profile?.sex || 'Not specified'}  
- Blood Type: ${parsedUserContext.profile?.bloodType || 'Not specified'}

FAMILY HISTORY:
${familyHistoryText}

PERSONAL MEDICAL HISTORY:
${personalHistoryText}

LIFESTYLE:
${lifestyleText}

MEDICATIONS & SUPPLEMENTS:
${medicationsText}

CURRENT MONITORING DATA:
${monitoringText}

RECENT LAB VALUES:
${labValuesText}

Question: ${query}

Instructions: Answer using ONLY the patient information above. Be specific with values.`
            }
          ],
          max_tokens: 300,
          temperature: 0.1,
          top_p: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API error: ${response.status}`, errorText);
        return `Error: Unable to process your personal question. (${response.status})`;
      }

      const result = await response.json();
      
      if (!result.choices?.[0]?.message?.content) {
        console.error("❌ Invalid response structure");
        return "Error: Received invalid response from AI service.";
      }
      
      const answer = result.choices[0].message.content.trim();
      console.log("✅ Generated personal response");
      return cleanResponse(answer);
    }

    // ==========================================
    // HANDLE GENERAL MEDICAL QUESTIONS (with document context)
    // ==========================================
    console.log("📚 Handling general medical question");
    
    if (!context || context.length === 0) {
      return "I don't have information about that topic in my medical knowledge database.";
    }
    
    const formattedContext = formatContext(context);
    
    // Limit context size to prevent overwhelming the LLM
    const maxContextLength = 8000;
    const truncatedContext = formattedContext.length > maxContextLength
      ? formattedContext.substring(0, maxContextLength) + "\n\n[Content truncated for brevity]"
      : formattedContext;
    
    console.log("📊 Context length after formatting:", truncatedContext.length);
    
    // DEBUG: Log what's being sent to the AI
    console.log("\n🔍 DEBUG - First 1000 chars of context:");
    console.log(truncatedContext.substring(0, 1000));
    console.log("\n🔍 DEBUG - Last 500 chars of context:");
    console.log(truncatedContext.substring(truncatedContext.length - 500));

    // For general questions, DON'T include patient info - just answer from medical knowledge
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
            content: `You are Reed, a health assistant. Answer questions clearly and directly using the medical information provided.

When the context contains the answer:
- Provide the information directly and completely
- Preserve formatting like numbered lists, bullet points, and headers
- Include all items from lists
- Include specific numbers and statistics
- Answer naturally without phrases like "According to the context"

If the context doesn't contain relevant information, say so briefly.`
          },
          {
            role: 'user', 
            content: `Medical Knowledge:
${truncatedContext}

Question: ${query}

Answer the question using the medical knowledge above. If the information is there, provide it clearly and completely.`
          }
        ],
        max_tokens: 500,
        temperature: 0.1,
        top_p: 0.7,
        repetition_penalty: 1.2
      })
    });

    console.log("📡 Together AI response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error: ${response.status}`, errorText);
      return `Error: Unable to process your question. (${response.status})`;
    }

    const result = await response.json();
    
    if (!result.choices?.[0]?.message?.content) {
      console.error("❌ Invalid response structure");
      return "Error: Received invalid response from AI service.";
    }
    
    const answer = result.choices[0].message.content.trim();

    if (!answer) {
      console.error("❌ Empty response");
      return "Error: No response generated. Please try again.";
    }

    console.log("✅ Generated response successfully");
    return cleanResponse(answer);

  } catch (error) {
    console.error("❌ Error:", error);
    return "Error processing your request: " + error.message;
  }
}

// ============================================
// TEST FUNCTION
// ============================================

async function testModel() {
  try {
    const response = await generateBasicResponse(
      "What is a healthy cholesterol level?",
      "LDL cholesterol levels below 100 mg/dL are considered optimal. Levels between 100-129 mg/dL are considered near optimal."
    );

    return {
      model: "mistralai/Mistral-7B-Instruct-v0.1 (Together AI)",
      response: response,
    };
  } catch (error) {
    console.error("Test failed:", error);
    return { error: error.message };
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  cleanResponse,
  generateEmbedding,
  generateBasicResponse,
  testModel,
  checkTogetherAIStatus,
  isPersonalHealthQuestion
};

console.log('✅ chatService.js loaded with enhanced response generation');