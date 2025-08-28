// api/feedback.js - Vercel serverless function
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Only POST requests are accepted.' 
    });
  }

  try {
    const { name, email, message } = req.body;

    // Basic validation
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, email, and message are required.'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address format.'
      });
    }

    // Log feedback (in production, you'd want to save this to a database)
    console.log('Feedback received:', {
      timestamp: new Date().toISOString(),
      name: name.substring(0, 50), // Truncate for logging
      email,
      message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });

    // Here you could:
    // 1. Save to a database
    // 2. Send an email notification
    // 3. Send to a third-party service like Slack, Discord, etc.
    // 4. Save to a file (not recommended for Vercel)

    // For now, just return success
    return res.status(200).json({
      success: true,
      message: 'Feedback received successfully. Thank you!'
    });

  } catch (error) {
    console.error('Feedback API error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Internal server error. Please try again later.'
    });
  }
}