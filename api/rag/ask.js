// api/rag/ask.js (optimized with top-level imports)
// Move imports to module level to avoid repeated loading on cold starts
const { performRag, performRagWithContext } = require('../lib/medicalKnowledge');

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
    const startTime = Date.now();
    const { query, userContext, options } = req.body;
    
    console.log('Vercel RAG request received:', {
      query: query?.substring(0, 50) + '...',
      hasUserContext: !!userContext,
      timestamp: new Date().toISOString()
    });
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    // Add timeout protection (Vercel free tier has 10s limit)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 9000)
    );

    // Use context-aware RAG if userContext is provided
    const ragPromise = userContext 
      ? performRagWithContext(query, userContext, options || {})
      : performRag(query, options || {});

    const result = await Promise.race([ragPromise, timeoutPromise]);

    const duration = Date.now() - startTime;
    console.log('RAG request completed:', {
      duration: `${duration}ms`,
      hasResponse: !!result.response,
      sourcesCount: result.sources?.length || 0
    });

    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString(),
      service: 'vercel',
      contextUsed: !!userContext,
      processingTime: `${duration}ms`
    });

  } catch (error) {
    console.error('RAG request error:', {
      message: error.message,
      stack: error.stack?.substring(0, 200) + '...'
    });
    
    if (error.message === 'Request timeout') {
      res.status(504).json({ 
        success: false,
        error: 'Request timeout',
        message: 'The request took too long to process. Please try a simpler query.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: 'Failed to process your request',
        details: error.message
      });
    }
  }
}