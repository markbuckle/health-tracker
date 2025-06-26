// api/rag/ask.js
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
    const { query, options } = req.body;
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    console.log('Proxying RAG request to Railway...');

    const railwayUrl = process.env.RAILWAY_RAG_URL;
    console.log('Calling Railway API:', railwayUrl);
    
    const ragResponse = await fetch(`${railwayUrl}/api/rag/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Vercel-Proxy/1.0'
      },
      body: JSON.stringify({
        query,
        options: options || {}
      })
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
    
    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: result.timestamp,
      service: 'railway'
    });

  } catch (error) {
    console.error('Proxy error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your request'
    });
  }
}