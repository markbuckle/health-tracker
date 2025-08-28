// api/feedback.js
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { name, email, message } = req.body;
    
    // Your feedback handling logic here
    console.log('Feedback received:', { name, email, message });
    
    // For now, just return success
    res.status(200).json({ success: true, message: 'Feedback received' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}