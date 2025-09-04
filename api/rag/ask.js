// api/rag/ask.js - FIXED to use correct database
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
    console.log('🔧 Database Configuration Debug:');
    console.log('- POSTGRES_URI exists:', !!process.env.POSTGRES_URI);
    console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
    console.log('- POSTGRES_URI host:', process.env.POSTGRES_URI ? new URL(process.env.POSTGRES_URI).hostname : 'none');
    console.log('- DATABASE_URL host:', process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'none');
    
    const { query, userContext, options } = req.body;
    
    console.log('Request details:');
    console.log('- Query:', query);
    console.log('- User context provided:', !!userContext);
    
    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
        message: 'Please provide a query parameter'
      });
    }

    // ✅ FIXED: Use the EXTERNAL database with medical documents
    const externalDatabaseUrl = process.env.POSTGRES_URI;
    
    if (!externalDatabaseUrl) {
      console.error('❌ External database URL not found');
      return res.status(500).json({
        error: 'Database configuration missing',
        message: 'POSTGRES_URI not configured'
      });
    }

    // Call Supabase Edge Function
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/rag-chat`;
    
    // ✅ FIXED: Pass the CORRECT database connection
    const requestBody = {
      query,
      userContext,
      options: options || {},
      // Pass YOUR external database connection
      databaseConfig: {
        externalDatabaseUrl: process.env.POSTGRES_URI,  // This points to 117.181.141.111 with your medical docs
        openaiApiKey: process.env.OPENAI_API_KEY
      }
    };
    
    console.log('🔗 Calling Supabase Edge Function...');
    console.log('📍 Using database:', externalDatabaseUrl.substring(0, 50) + '...');
    console.log('🔑 Has OpenAI key:', !!requestBody.databaseConfig.openaiApiKey);
    
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Supabase response status:', response.status);

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
      hasResponse: !!result?.response,
      hasSources: !!result?.sources,
      sourcesCount: result?.sources?.length || 0
    });
    
    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString(),
      service: 'supabase-edge-external-db',
      contextUsed: result.contextUsed
    });

  } catch (error) {
    console.error('❌ Vercel proxy error:', error);
    console.error('Error stack:', error.stack);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process your request',
      details: error.message
    });
  }
}