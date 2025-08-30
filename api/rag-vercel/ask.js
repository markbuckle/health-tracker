// api/rag-vercel/ask.js
import { performRag, performRagWithContext } from '../../lib/medicalKnowledgeService';

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
    const { query, userContext, options = {} } = req.body;

    console.log('Vercel RAG - Query:', query);
    console.log('Vercel RAG - User context provided:', !!userContext);
    if (userContext) {
      console.log('Vercel RAG - User blood type:', userContext.profile?.bloodType);
    }

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Add timeout protection (Vercel has 10s limit on free tier)
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 9000)
    );

    // Use context-aware RAG if userContext is provided
    const ragPromise = userContext 
      ? performRagWithContext(query, userContext, options)
      : performRag(query, options);

    const result = await Promise.race([ragPromise, timeoutPromise]);

    res.status(200).json({
      success: true,
      response: result.response,
      sources: result.sources,
      timestamp: new Date().toISOString(),
      contextUsed: !!userContext,
      service: 'vercel'
    });

  } catch (error) {
    console.error("Error in Vercel RAG endpoint:", error);
    
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
}