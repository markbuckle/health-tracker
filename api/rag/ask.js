// api/rag/ask.js (updated to call Supabase Edge Function)
// api/rag/ask.js (with debugging)
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
    console.log('🔍 VERCEL RAG ENDPOINT CALLED');
    console.log('Environment variables check:');
    console.log('- NEXT_PUBLIC_SUPABASE_URL:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('- NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    
    const { query, userContext, options } = req.body;
    
    console.log('Request details:');
    console.log('- Query:', query);
    console.log('- User context provided:', !!userContext);
    console.log('- Options:', options);
    
    if (!query) {
      console.log('❌ No query provided');
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    // Call Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('❌ Supabase configuration missing');
      console.error('SUPABASE_URL present:', !!supabaseUrl);
      console.error('SUPABASE_ANON_KEY present:', !!supabaseAnonKey);
      
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Supabase configuration missing',
        debug: {
          hasUrl: !!supabaseUrl,
          hasKey: !!supabaseAnonKey
        }
      });
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/rag-chat`;
    console.log('🔗 Calling Supabase Edge Function:', edgeFunctionUrl);
    
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

    console.log('📡 Supabase response status:', response.status);
    console.log('📡 Supabase response ok:', response.ok);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Supabase Edge Function error:', response.status, errorData);
      
      return res.status(response.status).json({
        error: 'Edge Function error',
        message: errorData.error || 'Failed to process query',
        details: errorData.details || null,
        supabaseStatus: response.status
      });
    }

    const result = await response.json();
    console.log('✅ Supabase response received:', {
      hasResponse: !!result.response,
      hasSources: !!result.sources,
      contextUsed: result.contextUsed
    });
    
    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString(),
      service: 'supabase-edge',
      contextUsed: result.contextUsed
    });

  } catch (error) {
    console.error('❌ Vercel proxy error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your request',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}