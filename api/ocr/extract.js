//  API endpoint handler for OCR extraction

// /api/test.js
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'API working!',
    method: req.method,
    timestamp: new Date().toISOString()
  });
}