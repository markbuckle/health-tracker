// api/rag/ask.js (updated to call local Vercel function)
export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
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
    
    console.log('Vercel proxy received:');
    console.log('Query:', query);
    console.log('User context provided to proxy:', !!userContext);
    console.log('User context details:', userContext ? 'Has data' : 'No data');
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    console.log('Calling local Vercel RAG function...');
    
    // Import and call the local function directly
    const { performRag, performRagWithContext } = require('../../lib/medicalKnowledgeService');
    
    // Use context-aware RAG if userContext is provided
    const result = userContext 
      ? await performRagWithContext(query, userContext, options || {})
      : await performRag(query, options || {});

    console.log('Local RAG function result:', { 
      hasResponse: !!result.response,
      sourcesCount: result.sources?.length || 0
    });

    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString(),
      service: 'vercel-direct',
      contextUsed: !!userContext
    });

  } catch (error) {
    console.error('Local RAG function error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your request',
      details: error.message
    });
  }
}