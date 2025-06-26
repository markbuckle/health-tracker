// api/rag/ask.js - Vercel API route that proxies to Railway
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    const { query, options } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    console.log('Proxying RAG request to Railway...');

    // Call your Railway RAG API
    const ragResponse = await fetch(`${process.env.RAILWAY_RAG_URL}/api/rag/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Proxy/1.0'
      },
      body: JSON.stringify({
        query,
        options: options || {}
      }),
      timeout: 25000 // 25 second timeout
    });

    if (!ragResponse.ok) {
      const errorData = await ragResponse.json().catch(() => ({}));
      console.error('Railway API error:', ragResponse.status, errorData);
      
      return res.status(ragResponse.status).json({
        error: 'RAG service error',
        message: errorData.error || 'Failed to process query',
        details: errorData.details || null
      });
    }

    const result = await ragResponse.json();
    
    // Return the result to your frontend
    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: result.timestamp,
      service: 'railway'
    });

  } catch (error) {
    console.error('Proxy error:', error);
    
    if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
      res.status(504).json({
        error: 'Request timeout',
        message: 'The RAG service took too long to respond'
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'The RAG service is currently unavailable'
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to process your request'
      });
    }
  }
}

// Optional: Add configuration for Vercel
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
    responseLimit: false,
  },
}