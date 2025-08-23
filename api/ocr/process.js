// api/ocr/process.js - Vercel API endpoint with Google AI OCR integration

const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { query } = require('../../src/db/pgConnector'); // Updated path for pgConnector

// Import your Google AI OCR parser
let ocrParser;
try {
  // Use the same parser loading logic from your existing setup
  const isProductionMode = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  const ocrImplementation = process.env.OCR_IMPLEMENTATION || 'GoogleVision';
  const hasGoogleConfig = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && 
      (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY));

  console.log(`OCR API - Environment: ${isProductionMode ? 'Production' : 'Development'}`);
  console.log(`OCR API - Implementation: ${ocrImplementation}`);
  console.log(`OCR API - Has Google Config: ${hasGoogleConfig}`);

  if (ocrImplementation === 'GoogleVision' && hasGoogleConfig) {
    ocrParser = require('../../src/parsers/GoogleVision/smartOcrRouter');
    console.log('OCR API: Google Vision parser loaded successfully');
  } else {
    throw new Error('Google Vision OCR not configured properly');
  }
} catch (error) {
  console.error('Failed to load OCR parser:', error.message);
}

export const config = {
  api: {
    bodyParser: false, // Disable body parsing to handle multipart/form-data
  },
};

/**
 * Save OCR result to database
 */
async function saveOcrResult(filename, ocrResult, processingStats) {
  try {
    const insertQuery = `
      INSERT INTO ocr_results (
        filename, 
        extracted_text, 
        confidence_score,
        processing_provider,
        processing_time_ms,
        character_count,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id, created_at
    `;

    const values = [
      filename,
      ocrResult.text || '',
      ocrResult.confidence || 0,
      ocrResult.provider || 'google-ai',
      processingStats.processingTime || 0,
      (ocrResult.text || '').length
    ];

    const result = await query(insertQuery, values);
    console.log(`OCR result saved to database with ID: ${result.rows[0].id}`);
    return result.rows[0];
  } catch (error) {
    console.error('Failed to save OCR result to database:', error.message);
    // Don't throw - we still want to return the OCR result even if DB save fails
    return null;
  }
}

/**
 * Process file with Google AI OCR
 */
async function processWithGoogleAI(filePath, filename, progressCallback) {
  const startTime = Date.now();
  
  try {
    console.log(`Processing ${filename} with Google AI OCR...`);
    
    // Determine file type and use appropriate method
    const fileExtension = path.extname(filename).toLowerCase();
    let result;
    
    if (fileExtension === '.pdf') {
      // Use Document AI for PDFs if available, otherwise Vision API
      console.log('Processing PDF with Google AI...');
      result = await ocrParser.processPdfWithDocumentAI(filePath, {
        updateProgress: progressCallback,
        log: console.log
      });
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(fileExtension)) {
      // Use Vision API for images
      console.log('Processing image with Google Vision API...');
      result = await ocrParser.processImageWithVision(filePath, {
        updateProgress: progressCallback,
        log: console.log
      });
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }

    const processingTime = Date.now() - startTime;
    
    console.log(`Google AI OCR completed in ${processingTime}ms`);
    console.log(`Extracted ${result.text?.length || 0} characters with ${((result.confidence || 0) * 100).toFixed(1)}% confidence`);

    return {
      ...result,
      processingTime
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('Google AI OCR processing failed:', error.message);
    
    return {
      text: '',
      confidence: 0,
      provider: 'google-ai-error',
      processingTime,
      error: error.message
    };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  // Check if OCR parser is available
  if (!ocrParser) {
    return res.status(503).json({
      success: false,
      error: 'OCR service unavailable',
      message: 'Google AI OCR is not properly configured. Please check environment variables.'
    });
  }

  let tempFilePath = null;

  try {
    console.log('Processing OCR request with Google AI...');

    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      keepExtensions: true,
      uploadDir: '/tmp', // Use Vercel's tmp directory
    });

    const [fields, files] = await form.parse(req);
    
    if (!files.file || !files.file[0]) {
      return res.status(400).json({
        error: 'No file provided',
        message: 'Please upload a file'
      });
    }

    const uploadedFile = files.file[0];
    tempFilePath = uploadedFile.filepath;
    
    console.log(`Processing file: ${uploadedFile.originalFilename}`);
    console.log(`File size: ${uploadedFile.size} bytes`);
    console.log(`File type: ${uploadedFile.mimetype}`);

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
      'application/pdf'
    ];
    
    if (!allowedTypes.includes(uploadedFile.mimetype)) {
      throw new Error(`Unsupported file type: ${uploadedFile.mimetype}. Supported types: ${allowedTypes.join(', ')}`);
    }

    // Progress callback for real-time updates (could be used with WebSocket in the future)
    const progressCallback = (progress, status, substatus) => {
      console.log(`Progress: ${progress.toFixed(1)}% - ${status} ${substatus ? `(${substatus})` : ''}`);
    };

    // Process with Google AI OCR
    const ocrResult = await processWithGoogleAI(
      tempFilePath, 
      uploadedFile.originalFilename,
      progressCallback
    );

    // Determine parsing mode based on request
    const shouldParse = fields.parse && fields.parse[0] === 'true';
    
    // Save to database
    const dbResult = await saveOcrResult(
      uploadedFile.originalFilename,
      ocrResult,
      { processingTime: ocrResult.processingTime }
    );

    // Prepare response
    const response = {
      success: true,
      filename: uploadedFile.originalFilename,
      text: ocrResult.text || '',
      confidence: ocrResult.confidence || 0,
      provider: ocrResult.provider || 'google-ai',
      processing_time_ms: ocrResult.processingTime || 0,
      character_count: (ocrResult.text || '').length,
      file_size: uploadedFile.size,
      file_type: uploadedFile.mimetype,
      processed_at: new Date().toISOString(),
      database_saved: !!dbResult,
      database_id: dbResult?.id || null
    };

    // Add parsing results if requested
    if (shouldParse && ocrResult.text) {
      console.log('Parsing mode requested - extracting structured data...');
      
      try {
        // Use your existing lab parsing logic if available
        // This would integrate with your existing biomarker extraction
        const parseResult = await ocrParser.extractFromPDF?.(tempFilePath) || {};
        
        response.parsed_data = {
          lab_values: parseResult.labValues || {},
          test_date: parseResult.testDate || new Date(),
          parsing_confidence: parseResult.confidence || 0,
          parsing_errors: parseResult.processingErrors || []
        };
        
        console.log(`Parsing completed - found ${Object.keys(parseResult.labValues || {}).length} lab values`);
      } catch (parseError) {
        console.error('Parsing failed:', parseError.message);
        response.parsed_data = {
          lab_values: {},
          test_date: new Date(),
          parsing_confidence: 0,
          parsing_errors: [parseError.message]
        };
      }
    }

    // Add error information if present
    if (ocrResult.error) {
      response.processing_errors = [ocrResult.error];
      response.success = false;
    }

    console.log('OCR processing completed successfully');
    res.status(200).json(response);

  } catch (error) {
    console.error('Error processing OCR request:', error);
    
    // Return appropriate error based on type
    let status = 500;
    let errorType = 'Processing failed';
    let message = error.message || 'An unexpected error occurred';

    if (error.message.includes('file type')) {
      status = 400;
      errorType = 'Invalid file type';
    } else if (error.message.includes('size')) {
      status = 413;
      errorType = 'File too large';
    } else if (error.message.includes('timeout')) {
      status = 408;
      errorType = 'Request timeout';
    } else if (error.message.includes('quota') || error.message.includes('limit')) {
      status = 429;
      errorType = 'Rate limit exceeded';
    } else if (error.message.includes('credentials') || error.message.includes('authentication')) {
      status = 503;
      errorType = 'Service configuration error';
    }

    res.status(status).json({
      success: false,
      error: errorType,
      message: message,
      processed_at: new Date().toISOString()
    });
  } finally {
    // Clean up uploaded file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('Temporary file cleaned up');
      } catch (cleanupError) {
        console.warn('Could not clean up temporary file:', cleanupError.message);
      }
    }
  }
}