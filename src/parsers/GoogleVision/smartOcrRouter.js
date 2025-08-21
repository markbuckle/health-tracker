// src/parsers/GoogleVision/smartOcrRouter.js - WORKING VERSION
const vision = require('@google-cloud/vision');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const fs = require('fs');
const path = require('path');
const { visionConfig } = require('./config');

// Initialize both clients
let visionClient;
let documentAIClient;

try {
  // Vision API for images
  visionClient = new vision.ImageAnnotatorClient(visionConfig);
  console.log('Google Cloud Vision client initialized successfully');
  
  // Document AI for PDFs
  documentAIClient = new DocumentProcessorServiceClient(visionConfig);
  console.log('Google Document AI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Google Cloud clients:', error.message);
}

/**
 * Detect file type and route to appropriate OCR service
 * @param {string} filePath - Path to the file to process
 * @returns {string} File type ('pdf', 'image', or 'unknown')
 */
function detectFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  
  if (extension === '.pdf') {
    return 'pdf';
  } else if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(extension)) {
    return 'image';
  } else {
    return 'unknown';
  }
}

/**
 * Process PDF using Document AI Enterprise OCR
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function processPdfWithDocumentAI(filePath) {
  console.log('Smart OCR: Using Document AI for PDF processing');
  
  if (!documentAIClient) {
    throw new Error('Document AI client not initialized');
  }
  
  try {
    // Read the PDF file
    const fileContent = fs.readFileSync(filePath);
    
    // Document AI processor configuration - using FREE OCR processor
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION || 'us'; 
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    
    if (!processorId) {
      throw new Error('DOCUMENT_AI_PROCESSOR_ID not configured. Please create a FREE OCR processor first.');
    }
    
    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    console.log('Document AI: Using FREE OCR processor:', processorId);
    
    const request = {
      name,
      rawDocument: {
        content: fileContent,
        mimeType: 'application/pdf',
      },
    };
    
    console.log('Document AI: Making API call...');
    const [result] = await documentAIClient.processDocument(request);
    
    const document = result.document;
    let fullText = '';
    let confidence = 0;
    
    if (document.text) {
      fullText = document.text;
      console.log(`Document AI: Extracted ${fullText.length} characters`);
      
      // Calculate average confidence from pages/blocks
      if (document.pages && document.pages.length > 0) {
        let totalConfidence = 0;
        let blockCount = 0;
        
        document.pages.forEach(page => {
          if (page.blocks) {
            page.blocks.forEach(block => {
              if (block.layout && block.layout.confidence) {
                totalConfidence += block.layout.confidence;
                blockCount++;
              }
            });
          }
        });
        
        confidence = blockCount > 0 ? totalConfidence / blockCount : 0;
      }
    }
    
    return {
      text: fullText,
      confidence: confidence,
      provider: 'document-ai',
      processingTime: Date.now()
    };
    
  } catch (error) {
    console.error('Document AI processing error:', error.message);
    throw error;
  }
}

/**
 * Process image using Google Cloud Vision API
 * @param {string} filePath - Path to the image file
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function processImageWithVision(filePath) {
  console.log('Smart OCR: Using Vision API for image processing');
  
  if (!visionClient) {
    throw new Error('Vision API client not initialized');
  }
  
  try {
    console.log('Vision API: Making API call...');
    const [result] = await visionClient.textDetection(filePath);
    
    let fullText = '';
    let confidence = 0;
    
    if (result.error) {
      throw new Error(`Vision API error: ${result.error.message}`);
    }
    
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      fullText = result.textAnnotations[0].description || '';
      confidence = result.textAnnotations[0].score || 0;
      console.log(`Vision API: Extracted ${fullText.length} characters`);
    }
    
    return {
      text: fullText,
      confidence: confidence,
      provider: 'vision-api',
      processingTime: Date.now()
    };
    
  } catch (error) {
    console.error('Vision API processing error:', error.message);
    throw error;
  }
}

/**
 * Simple biomarker parsing function
 * @param {string} text - Raw OCR text
 * @returns {Object} Parsed lab values
 */
function parseLabValues(text) {
  console.log('Smart OCR: Starting basic biomarker parsing...');
  
  if (!text || text.length === 0) {
    console.log('Smart OCR: No text provided for parsing');
    return {};
  }
  
  const results = {};
  
  // Define simple patterns for common biomarkers
  const biomarkerPatterns = {
    'Hemoglobin': {
      regex: /(?:Hemoglobin|Hgb)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'g/dL'
    },
    'Hematocrit': {
      regex: /(?:Hematocrit|Hct)\s*:?\s*(\d+\.?\d*)/i,
      unit: '%'
    },
    'Glucose': {
      regex: /(?:Glucose|GLU)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Total Cholesterol': {
      regex: /(?:Total Cholesterol|CHOL)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'HDL Cholesterol': {
      regex: /(?:HDL|HDL Cholesterol)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'LDL Cholesterol': {
      regex: /(?:LDL|LDL Cholesterol)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Triglycerides': {
      regex: /(?:Triglycerides|TRIG)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Creatinine': {
      regex: /(?:Creatinine|CREA)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'BUN': {
      regex: /(?:BUN|Blood Urea Nitrogen)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Sodium': {
      regex: /(?:Sodium|NA)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Potassium': {
      regex: /(?:Potassium|K)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Chloride': {
      regex: /(?:Chloride|CL)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    }
  };
  
  // Normalize text for better matching
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  console.log(`Smart OCR: Searching for biomarkers in ${normalizedText.length} character text`);
  
  // Try to match each biomarker pattern
  let matchCount = 0;
  for (const [biomarkerName, pattern] of Object.entries(biomarkerPatterns)) {
    try {
      const match = pattern.regex.exec(normalizedText);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          console.log(`Smart OCR: Found ${biomarkerName} = ${value} ${pattern.unit}`);
          
          results[biomarkerName] = {
            value: value,
            unit: pattern.unit,
            rawText: match[0].trim(),
            referenceRange: null,
            confidence: 0.8
          };
          matchCount++;
        }
      }
    } catch (error) {
      console.error(`Smart OCR: Error parsing ${biomarkerName}:`, error.message);
    }
  }
  
  console.log(`Smart OCR: Found ${matchCount} biomarkers total`);
  return results;
}

/**
 * Extract test date from text
 * @param {string} text - Raw OCR text
 * @returns {Date} Extracted date or current date
 */
function extractTestDate(text) {
  console.log('Smart OCR: Extracting test date...');
  
  if (!text || typeof text !== 'string') {
    return new Date();
  }
  
  // Simple date patterns
  const datePatterns = [
    /Collection Date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const dateStr = match[1];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
          console.log(`Smart OCR: Found test date: ${parsedDate.toDateString()}`);
          return parsedDate;
        }
      } catch (error) {
        console.error('Smart OCR: Error parsing date:', error.message);
      }
    }
  }
  
  console.log('Smart OCR: No date found, using current date');
  return new Date();
}

/**
 * Smart OCR function that routes to appropriate service based on file type
 * @param {string} filePath - Path to the file to process
 * @returns {Promise<Object>} Extracted text and metadata
 */
async function extractTextFromFile(filePath) {
  console.log(`=== Smart OCR: Processing file ${filePath} ===`);
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Detect file type
  const fileType = detectFileType(filePath);
  console.log(`Smart OCR: Detected file type: ${fileType}`);
  
  let result;
  
  switch (fileType) {
    case 'pdf':
      result = await processPdfWithDocumentAI(filePath);
      break;
      
    case 'image':
      result = await processImageWithVision(filePath);
      break;
      
    default:
      throw new Error(`Unsupported file type: ${path.extname(filePath)}`);
  }
  
  console.log(`Smart OCR: Completed using ${result.provider}`);
  console.log(`Smart OCR: Text length: ${result.text.length} characters`);
  console.log(`Smart OCR: Confidence: ${(result.confidence * 100).toFixed(1)}%`);
  
  // Log first 200 characters for debugging
  if (result.text.length > 0) {
    console.log(`Smart OCR: First 200 characters: "${result.text.substring(0, 200)}"`);
  }
  
  return result;
}

/**
 * Main extraction function (matching PaddleOCR interface)
 * @param {string} filePath - Path to the file to process
 * @returns {Promise<Object>} Lab extraction results
 */
async function extractFromPDF(filePath) {
  console.log(`=== Smart OCR: Starting lab extraction for ${filePath} ===`);
  
  try {
    // Extract text using smart routing
    const ocrResult = await extractTextFromFile(filePath);
    
    // Parse biomarkers from the extracted text
    console.log('Smart OCR: Starting biomarker parsing...');
    const labValues = parseLabValues(ocrResult.text);
    const testDate = extractTestDate(ocrResult.text);
    
    // Return consistent format
    const result = {
      labValues: labValues,
      testDate: testDate,
      rawText: ocrResult.text,
      confidence: ocrResult.confidence,
      provider: ocrResult.provider,
      processingErrors: []
    };
    
    const labCount = Object.keys(labValues).length;
    console.log(`Smart OCR: Extraction completed using ${ocrResult.provider}`);
    console.log(`Smart OCR: Found ${labCount} biomarkers`);
    console.log(`Smart OCR: Text length: ${ocrResult.text.length} characters`);
    console.log(`Smart OCR: Confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`);
    
    if (labCount > 0) {
      console.log('Smart OCR: Biomarkers found:', Object.keys(labValues));
    }
    
    return result;
    
  } catch (error) {
    console.error('Smart OCR extraction failed:', error.message);
    
    return {
      labValues: {},
      testDate: new Date(),
      rawText: '',
      confidence: 0,
      provider: 'smart-ocr-error',
      processingErrors: [error.message]
    };
  }
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
  interpretConfidence,
  detectFileType,
  processPdfWithDocumentAI,
  processImageWithVision
};