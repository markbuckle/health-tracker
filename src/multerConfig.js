// Update your multerConfig.js
async function processWithHuggingFace(file) {
  const fs = require('fs');
  const fetch = require('node-fetch');
  
  try {
    const fileBuffer = fs.readFileSync(file.path);
    const base64Data = fileBuffer.toString('base64');
    
    const response = await fetch(`${process.env.PADDLEOCR_SERVICE_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: [{
          file: base64Data,
          filename: file.originalname
        }]
      })
    });
    
    const result = await response.json();
    return JSON.parse(result.data[0]); // Gradio wraps response in data array
    
  } catch (error) {
    console.error('Hugging Face API error:', error);
    throw error;
  }
}