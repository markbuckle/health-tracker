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
    const { query, userContext } = req.body; // Add userContext here

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    console.log('🔍 RAG request received');
    console.log('🔍 Query:', query);
    console.log('🔍 User context provided:', !!userContext);

    // Use context-aware RAG if userContext is provided
    const result = userContext 
      ? await medicalKnowledgeService.performRagWithContext(query, userContext)
      : await medicalKnowledgeService.performRag(query);

    res.json({
      response: result.response,
      sources: result.sources,
      contextUsed: !!userContext
    });
  } catch (error) {
    console.error("Error in /ask endpoint:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
});

module.exports = router;
