// railway-rag-api/server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'https://your-vercel-app.vercel.app',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Import your existing services
const medicalKnowledgeService = require('./services/medicalKnowledgeService');

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'RAG API'
  });
});

// Test endpoint
app.get('/api/rag/test', (req, res) => {
  res.json({ message: "RAG API is working on Railway!" });
});

// Main RAG endpoint
app.post('/api/rag/ask', async (req, res) => {
  try {
    console.log(`RAG API Request: ${req.method} ${req.path}`);
    
    const { query, options = {} } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Add timeout protection
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 25000)
    );

    const ragPromise = medicalKnowledgeService.performRag(query, options);

    const result = await Promise.race([ragPromise, timeoutPromise]);

    res.json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error in RAG endpoint:", error);
    
    if (error.message === 'Request timeout') {
      res.status(504).json({ 
        success: false,
        error: "Request timeout - try a simpler query" 
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: "Failed to process query",
        details: error.message 
      });
    }
  }
});

// Add document endpoint (for testing/admin)
app.post('/api/rag/add-document', async (req, res) => {
  try {
    const { title, content, source, categories } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required" });
    }

    const documentId = await medicalKnowledgeService.addDocument({
      title,
      content,
      source: source || 'Manual',
      categories: categories || []
    });

    res.json({
      success: true,
      documentId,
      message: "Document added successfully"
    });

  } catch (error) {
    console.error("Error adding document:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to add document" 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

app.listen(port, () => {
  console.log(`🚀 RAG API Server running on port ${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});

module.exports = app;