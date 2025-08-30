// api/rag/ask.js (consolidated version)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    const { query, userContext, options } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    // Import and call the local functions directly
    const { performRag, performRagWithContext } = require('../../lib/medicalKnowledgeService');
    
    const result = userContext 
      ? await performRagWithContext(query, userContext, options || {})
      : await performRag(query, options || {});

    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString(),
      service: 'vercel',
      contextUsed: !!userContext
    });

  } catch (error) {
    console.error('RAG error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your request',
      details: error.message
    });
  }
}