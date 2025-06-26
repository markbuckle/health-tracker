// api/simple-test.js
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Simple test working!',
    timestamp: new Date().toISOString()
  });
}