const express = require("express");
const router = express.Router();
const medicalKnowledgeService = require("../medicalKnowledgeService");

// Simple middleware for logging
router.use((req, res, next) => {
  console.log(`RAG API Request: ${req.method} ${req.path}`);
  next();
});

// Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "RAG API is working!" });
});

// Ask endpoint
router.post("/ask", async (req, res) => {
  try {
    const { query, userContext } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log('🔍 RAG request received');
    console.log('🔍 Query:', query);
    console.log('🔍 User context provided:', !!userContext);

    // Add detailed logging before making the service call
    console.log('🔍 Performing RAG with context:', !!userContext);

    let result;
    try {
      // Use context-aware RAG if userContext is provided
      result = userContext 
        ? await medicalKnowledgeService.performRagWithContext(query, userContext)
        : await medicalKnowledgeService.performRag(query);
      
      console.log('🔍 RAG service result:', result);
      console.log('🔍 Result type:', typeof result);
      console.log('🔍 Result has response property:', result && typeof result === 'object' && 'response' in result);
    } catch (serviceError) {
      console.error('🚨 Medical knowledge service error:', serviceError);
      throw serviceError; // Re-throw to be caught by outer try-catch
    }

    // Check if result is valid before accessing properties
    if (!result) {
      console.error('🚨 RAG service returned null/undefined result');
      return res.status(500).json({ 
        error: "RAG service returned empty result",
        debug: "The medical knowledge service returned null or undefined"
      });
    }

    // Check if result has expected structure
    if (typeof result !== 'object') {
      console.error('🚨 RAG service returned non-object result:', typeof result);
      return res.status(500).json({ 
        error: "RAG service returned invalid result type",
        debug: `Expected object, got ${typeof result}`
      });
    }

    // Check for response property specifically
    if (!('response' in result)) {
      console.error('🚨 RAG service result missing response property:', Object.keys(result));
      return res.status(500).json({ 
        error: "RAG service result missing response property",
        debug: `Available properties: ${Object.keys(result).join(', ')}`
      });
    }

    // Success response with additional safety checks
    const responseData = {
      response: result.response || "No response generated",
      sources: result.sources || [],
      contextUsed: !!userContext
    };

    console.log('✅ Successfully sending response:', responseData);
    res.json(responseData);

  } catch (error) {
    console.error("🚨 Error in /ask endpoint:", error);
    console.error("🚨 Error stack:", error.stack);
    
    // More detailed error response
    res.status(500).json({ 
      error: "Failed to process query",
      message: error.message,
      type: error.constructor.name,
      debug: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

module.exports = router;