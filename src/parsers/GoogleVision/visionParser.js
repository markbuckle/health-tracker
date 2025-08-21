// src/parsers/GoogleVision/visionParser.js - FIXED VERSION with PDF handling
const vision = require('@google-cloud/vision');
const fs = require('fs');
const path = require('path');
const { visionConfig } = require('./config');

// Initialize the Vision API client
let client;
try {
  client = new vision.ImageAnnotatorClient(visionConfig);
  console.log('Google Cloud Vision client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Google Cloud Vision client:', error.message);
}

/**
 * Convert PDF to image buffer for Vision API processing
 * This is a simplified approach - for production you might want pdf2pic or similar
 */
async function convertPdfToImage(filePath) {
  // For now, we'll read the PDF as binary and let Vision API handle it
  // Google Vision API should handle PDFs, but some formats cause issues
  
  // Try reading as buffer first
  const buffer = fs.readFileSync(filePath);
  console.log(`Google Vision: Read PDF buffer of ${buffer.length} bytes`);
  
  return buffer;
}

/**
 * Extract text from PDF or image using Google Cloud Vision API
 * @param {string} filePath - Path to the file to process
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function extractTextFromFile(filePath) {
  console.log(`=== Google Vision: Processing file ${filePath} ===`);
  
  if (!client) {
    throw new Error('Google Cloud Vision client not initialized');
  }
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    const fileExtension = path.extname(filePath).toLowerCase();
    let fullText = '';
    let confidence = 0;
    
    console.log(`Google Vision: Processing ${fileExtension} file`);
    
    if (fileExtension === '.pdf') {
      console.log('Google Vision: Processing PDF file');
      
      try {
        // Method 1: Try direct PDF processing
        console.log('Google Vision: Attempting direct PDF processing...');
        const [result] = await client.documentTextDetection(filePath);
        
        if (result.error) {
          console.log('Google Vision: Direct PDF failed:', result.error.message);
          throw new Error(`PDF processing failed: ${result.error.message}`);
        }
        
        if (result.fullTextAnnotation && result.fullTextAnnotation.text) {
          fullText = result.fullTextAnnotation.text;
          console.log(`Google Vision: Direct PDF success - ${fullText.length} characters`);
          
          // Calculate confidence
          const pages = result.fullTextAnnotation.pages || [];
          if (pages.length > 0) {
            const totalConfidence = pages.reduce((sum, page) => {
              const blocks = page.blocks || [];
              const blockConfidence = blocks.reduce((blockSum, block) => {
                return blockSum + (block.confidence || 0);
              }, 0);
              return sum + (blockConfidence / Math.max(blocks.length, 1));
            }, 0);
            confidence = totalConfidence / pages.length;
          }
        } else {
          throw new Error('No text found in PDF');
        }
        
      } catch (pdfError) {
        console.log('Google Vision: Direct PDF processing failed, trying as image...');
        
        // Method 2: Try reading PDF as image (for scanned PDFs)
        const buffer = await convertPdfToImage(filePath);
        
        console.log('Google Vision: Trying PDF as image buffer...');
        const [imageResult] = await client.textDetection({
          image: { content: buffer }
        });
        
        if (imageResult.error) {
          throw new Error(`PDF image processing failed: ${imageResult.error.message}`);
        }
        
        if (imageResult.textAnnotations && imageResult.textAnnotations.length > 0) {
          fullText = imageResult.textAnnotations[0].description || '';
          confidence = imageResult.textAnnotations[0].score || 0;
          console.log(`Google Vision: PDF as image success - ${fullText.length} characters`);
        } else {
          throw new Error('No text found in PDF (tried as image)');
        }
      }
      
    } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
      console.log('Google Vision: Using TEXT_DETECTION for image');
      
      // For image files, use TEXT_DETECTION
      const [result] = await client.textDetection(filePath);
      
      if (result.error) {
        throw new Error(`Image processing failed: ${result.error.message}`);
      }
      
      if (result.textAnnotations && result.textAnnotations.length > 0) {
        fullText = result.textAnnotations[0].description || '';
        confidence = result.textAnnotations[0].score || 0;
        console.log(`Google Vision: Image processing success - ${fullText.length} characters`);
      } else {
        console.log('Google Vision: No text found in image');
      }
      
    } else {
      throw new Error(`Unsupported file type: ${fileExtension}`);
    }
    
    console.log(`Google Vision: Final result - ${fullText.length} characters, confidence: ${(confidence * 100).toFixed(1)}%`);
    
    // Log first 200 characters for debugging
    if (fullText.length > 0) {
      console.log(`Google Vision: First 200 characters: "${fullText.substring(0, 200)}"`);
    }
    
    return {
      text: fullText,
      confidence: confidence,
      provider: 'google-vision',
      processingTime: Date.now()
    };
    
  } catch (error) {
    console.error('Google Vision extraction error:', error.message);
    throw error;
  }
}

/**
 * Extract lab values from file (main function matching PaddleOCR interface)
 * @param {string} filePath - Path to the file to process
 * @returns {Promise<Object>} Lab extraction results
 */
async function extractFromPDF(filePath) {
  console.log(`=== Google Vision: Starting lab extraction for ${filePath} ===`);
  
  try {
    // Extract text using Google Vision
    const ocrResult = await extractTextFromFile(filePath);
    
    // For now, return minimal structure - we'll add biomarker parsing later
    const result = {
      labValues: {}, // Will be populated with actual parsing logic later
      testDate: new Date(),
      rawText: ocrResult.text,
      confidence: ocrResult.confidence,
      provider: 'google-vision',
      processingErrors: []
    };
    
    console.log(`Google Vision: Extraction completed`);
    console.log(`Google Vision: Text length: ${ocrResult.text.length} characters`);
    console.log(`Google Vision: Confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`);
    
    return result;
    
  } catch (error) {
    console.error('Google Vision lab extraction failed:', error.message);
    
    return {
      labValues: {},
      testDate: new Date(),
      rawText: '',
      confidence: 0,
      provider: 'google-vision',
      processingErrors: [error.message]
    };
  }
}

/**
 * Simple text parsing function (placeholder for future biomarker logic)
 * @param {string} text - Raw OCR text
 * @returns {Object} Parsed lab values
 */
function parseLabValues(text) {
  // Placeholder - will implement biomarker extraction logic later
  console.log('Google Vision: parseLabValues called (placeholder implementation)');
  return {};
}

/**
 * Extract test date from text (placeholder)
 * @param {string} text - Raw OCR text
 * @returns {Date} Extracted date or current date
 */
function extractTestDate(text) {
  // Placeholder - will implement date extraction logic later
  return new Date();
}

/**
 * Interpret confidence score
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} Human-readable confidence level
 */
function interpretConfidence(confidence) {
  if (confidence >= 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  if (confidence >= 0.5) return 'low';
  return 'very-low';
}

module.exports = {
  extractFromPDF,
  extractTextFromFile,
  parseLabValues,
  extractTestDate,
  interpretConfidence
};