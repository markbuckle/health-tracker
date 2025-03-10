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
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const result = await medicalKnowledgeService.performRag(query);

    res.json({
      response: result.response,
      sources: result.sources,
    });
  } catch (error) {
    console.error("Error in /ask endpoint:", error);
    res.status(500).json({ error: "Failed to process query" });
  }
});

module.exports = router;
