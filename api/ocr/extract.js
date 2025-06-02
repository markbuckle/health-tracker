//  API endpoint handler for OCR extraction

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fileData, fileName } = req.body;
    
    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // Option 2 calls your external PaddleOCR service
    const result = await callExternalPaddleOCR(fileData, fileName);
    
    res.status(200).json({
      success: true,
      text: result.text,
      labValues: result.labValues,
      testDate: result.testDate,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({
      success: false,
      error: 'OCR processing failed',
      message: error.message
    });
  }
}

async function callExternalPaddleOCR(fileData, fileName) {
  const fetch = (await import('node-fetch')).default;
  
  const response = await fetch(process.env.PADDLEOCR_SERVICE_URL + '/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.PADDLEOCR_API_KEY ? `Bearer ${process.env.PADDLEOCR_API_KEY}` : undefined
    },
    body: JSON.stringify({
      file: fileData,
      filename: fileName
    }),
    timeout: 120000
  });

  if (!response.ok) {
    throw new Error(`External PaddleOCR service error: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.success) {
    throw new Error(result.error || 'PaddleOCR processing failed');
  }

  // Parse the text using your existing JavaScript parsers
  const { parseLabValues, extractTestDate } = await import('../../src/parsers/PaddleOCR/labParser.js');
  
  return {
    text: result.text,
    labValues: parseLabValues(result.text),
    testDate: extractTestDate(result.text, fileName),
    processingTime: result.processing_time || 0
  };
}