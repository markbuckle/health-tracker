// api/ocr/process.js - Vercel API endpoint to integrate with Digital Ocean OCR service

const formidable = require('formidable');
const FormData = require('form-data');
const fetch = require('node-fetch');
const fs = require('fs');

// Your Digital Ocean OCR service URL
const OCR_SERVICE_URL = 'http://147.182.149.140:8000';

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle multipart/form-data
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    console.log('Processing OCR request...');

    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    
    if (!files.file || !files.file[0]) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a file'
      });
    }

    const uploadedFile = files.file[0];
    console.log(`Processing file: ${uploadedFile.originalFilename}`);

    // Create form data to send to OCR service
    const formData = new FormData();
    formData.append('file', fs.createReadStream(uploadedFile.filepath), {
      filename: uploadedFile.originalFilename,
      contentType: uploadedFile.mimetype,
    });

    // Choose endpoint based on request
    const endpoint = fields.parse && fields.parse[0] === 'true' ? 'parse' : 'extract';
    
    console.log(`Sending to OCR service: ${OCR_SERVICE_URL}/${endpoint}`);

    // Forward request to your Digital Ocean OCR service
    const ocrResponse = await fetch(`${OCR_SERVICE_URL}/${endpoint}`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 120000, // 2 minute timeout
    });

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text();
      console.error('OCR service error:', errorText);
      throw new Error(`OCR service returned ${ocrResponse.status}: ${errorText}`);
    }

    const result = await ocrResponse.json();
    console.log('OCR processing completed successfully');

    // Clean up uploaded file
    try {
      fs.unlinkSync(uploadedFile.filepath);
    } catch (cleanupError) {
      console.warn('Could not clean up uploaded file:', cleanupError.message);
    }

    // Return the OCR result
    res.status(200).json({
      success: true,
      ...result,
      ocr_service: 'digital_ocean',
      processed_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error processing OCR request:', error);
    
    // Return appropriate error based on type
    if (error.code === 'ECONNREFUSED') {
      res.status(503).json({
        success: false,
        error: 'OCR service unavailable',
        message: 'The OCR service is currently unavailable. Please try again later.'
      });
    } else if (error.message.includes('timeout')) {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'The file took too long to process. Please try with a smaller file.'
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Processing failed',
        message: error.message || 'An unexpected error occurred'
      });
    }
  }
}