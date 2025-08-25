// api/rag/ask.js - IMPROVED VERSION
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
    
    console.log('🔍 Vercel proxy received:');
    console.log('🔍 Query:', query);
    console.log('🔍 User context provided to proxy:', !!userContext);
    console.log('🔍 User context details:', userContext ? 'Has data' : 'No data');
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    const flyioUrl = process.env.RAILWAY_RAG_URL;
    console.log('🔍 Calling Fly.io API:', flyioUrl); // ← Updated log message
    
    if (!flyioUrl) {
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Fly.io RAG URL not configured'
      });
    }

    // Improved fetch with timeout and better error handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30-second timeout
    
    try {
      const ragResponse = await fetch(`${flyioUrl}/api/rag/ask`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Vercel-Proxy/1.0',
          'Connection': 'keep-alive', // ← Help with TLS connection
        },
        body: JSON.stringify({
          query,
          userContext,
          options: options || {}
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      console.log('🔍 Sent to Fly.io:', { 
        query, 
        hasUserContext: !!userContext,
        options: options || {} 
      });

      console.log('🔍 Fly.io response status:', ragResponse.status);
      console.log('🔍 Fly.io response headers:', Object.fromEntries(ragResponse.headers));

      if (!ragResponse.ok) {
        let errorData;
        const contentType = ragResponse.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
          try {
            errorData = await ragResponse.json();
          } catch (jsonError) {
            console.error('Failed to parse error JSON:', jsonError);
            errorData = { error: 'Unknown error' };
          }
        } else {
          // If not JSON, get text response
          const errorText = await ragResponse.text();
          errorData = { error: 'Non-JSON error', details: errorText };
        }

        console.error('Fly.io API error:', ragResponse.status, errorData);
        
        return res.status(ragResponse.status).json({
          error: 'RAG service error',
          message: errorData.error || 'Failed to process query',
          details: errorData.details || null,
          status: ragResponse.status
        });
      }

      const result = await ragResponse.json();
      console.log('🔍 Fly.io success response received');
      
      res.status(200).json({
        success: true,
        response: result.response,
        sources: result.sources,
        timestamp: result.timestamp,
        service: 'fly.io', // ← Updated
        contextUsed: !!userContext
      });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('Request timeout to Fly.io');
        return res.status(504).json({
          error: 'Request timeout',
          message: 'The request to Fly.io timed out after 30 seconds'
        });
      }
      
      console.error('Fetch error to Fly.io:', fetchError.message);
      
      // Check for specific connection errors
      if (fetchError.message.includes('ECONNRESET') || 
          fetchError.message.includes('socket disconnected') ||
          fetchError.message.includes('TLS')) {
        return res.status(503).json({
          error: 'Connection error',
          message: 'Unable to establish secure connection to Fly.io service',
          details: fetchError.message
        });
      }
      
      throw fetchError; // Re-throw other errors to be caught by outer try-catch
    }

  } catch (error) {
    console.error('Proxy error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your request',
      details: error.message
    });
  }
}