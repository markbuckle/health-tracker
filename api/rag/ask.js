// api/rag/ask.js (updated to call Supabase Edge Function)
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
    
    console.log('Vercel proxy calling Supabase Edge Function');
    console.log('Query:', query);
    console.log('User context provided:', !!userContext);
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    // Call Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/rag-chat`;
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({
        query,
        userContext,
        options: options || {}
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Supabase Edge Function error:', response.status, errorData);
      
      return res.status(response.status).json({
        error: 'Edge Function error',
        message: errorData.error || 'Failed to process query',
        details: errorData.details || null
      });
    }

    const result = await response.json();
    
    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString(),
      service: 'supabase-edge',
      contextUsed: result.contextUsed
    });

  } catch (error) {
    console.error('Proxy error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your request',
      details: error.message
    });
  }
}