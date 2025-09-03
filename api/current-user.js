// api/current-user.js - Backup serverless endpoint
import { connectToMongoDB, registerCollection } from '../src/mongodb.js';

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  try {
    console.log('🔍 Backup current-user endpoint called');
    console.log('Headers:', Object.keys(req.headers));
    console.log('Cookies:', req.headers.cookie);
    
    // For now, return not authenticated since session handling is complex in serverless
    return res.status(401).json({ 
      authenticated: false,
      error: 'Session not available in serverless environment',
      debug: {
        hasCookies: !!req.headers.cookie,
        cookieCount: req.headers.cookie ? req.headers.cookie.split(';').length : 0
      }
    });

  } catch (error) {
    console.error('Current user endpoint error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}