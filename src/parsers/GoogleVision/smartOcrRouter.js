// src/parsers/GoogleVision/smartOcrRouter.js - ENHANCED WITH PROGRESS TRACKING

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
 * Enhanced progress tracking for Google Vision processing
 */
class ProgressTracker {
  constructor(fileIndex, totalFiles, progressCallback) {
    this.fileIndex = fileIndex;
    this.totalFiles = totalFiles;
    this.progressCallback = progressCallback;
    this.baseProgress = (fileIndex / totalFiles) * 100;
    this.fileProgressRange = 100 / totalFiles;
  }

  updateProgress(stepProgress, status, substatus = '') {
    const totalProgress = Math.min(this.baseProgress + (stepProgress / 100) * this.fileProgressRange, 99);
    if (this.progressCallback) {
      this.progressCallback(totalProgress, status, substatus);
    }
  }

  log(message) {
    console.log(message);
    // Send to WebSocket if available
    if (global.wsInstance) {
      global.wsInstance.send(message);
    }
  }
}

/**
 * Process PDF using Document AI with progress tracking
 */
async function processPdfWithDocumentAI(filePath, progressTracker) {
  progressTracker.log('Smart OCR: Using Document AI for PDF processing');
  progressTracker.updateProgress(5, 'Initializing Document AI...', `Processing file ${progressTracker.fileIndex + 1} of ${progressTracker.totalFiles}`);
  
  if (!documentAIClient) {
    throw new Error('Document AI client not initialized');
  }
  
  try {
    // Read the PDF file
    progressTracker.updateProgress(10, 'Reading PDF file...', 'Loading document into memory');
    const fileContent = fs.readFileSync(filePath);
    
    // Document AI processor configuration
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION || 'us'; 
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    
    if (!processorId) {
      throw new Error('DOCUMENT_AI_PROCESSOR_ID not configured. Please create a FREE OCR processor first.');
    }
    
    progressTracker.updateProgress(20, 'Preparing API request...', 'Configuring Document AI processor');
    
    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    
    progressTracker.log(`Document AI: Using FREE OCR processor: ${processorId}`);
    
    const request = {
      name: processorName,
      rawDocument: {
        content: fileContent,
        mimeType: 'application/pdf'
      }
    };
    
    progressTracker.updateProgress(30, 'Sending to Google Document AI...', 'Uploading document for OCR processing');
    progressTracker.log('Document AI: Making API call...');
    
    // Make the API call with progress simulation
    const progressInterval = setInterval(() => {
      const currentProgress = Math.min(progressTracker.baseProgress + 60, progressTracker.baseProgress + progressTracker.fileProgressRange * 0.8);
      progressTracker.updateProgress(60, 'Processing with Google AI...', 'Extracting text and analyzing document structure');
    }, 500);
    
    const [result] = await documentAIClient.processDocument(request);
    clearInterval(progressInterval);
    
    progressTracker.updateProgress(80, 'Extracting text...', 'Processing OCR results');
    
    let fullText = '';
    let totalConfidence = 0;
    let blockCount = 0;
    
    if (result.document && result.document.text) {
      fullText = result.document.text;
      
      // Calculate confidence from pages
      if (result.document.pages) {
        for (const page of result.document.pages) {
          if (page.blocks) {
            for (const block of page.blocks) {
              if (block.layout && block.layout.confidence) {
                totalConfidence += block.layout.confidence;
                blockCount++;
              }
            }
          }
        }
      }
    }
    
    const confidence = blockCount > 0 ? totalConfidence / blockCount : 0;
    
    progressTracker.log(`Document AI: Extracted ${fullText.length} characters`);
    progressTracker.updateProgress(90, 'Text extraction complete', `Found ${fullText.length} characters with ${(confidence * 100).toFixed(1)}% confidence`);
    
    return {
      text: fullText,
      confidence: confidence,
      provider: 'document-ai',
      processingTime: Date.now()
    };
    
  } catch (error) {
    progressTracker.log('Document AI processing error: ' + error.message);
    throw error;
  }
}

/**
 * Process image using Google Cloud Vision API with progress tracking
 */
async function processImageWithVision(filePath, progressTracker) {
  progressTracker.log('Smart OCR: Using Vision API for image processing');
  progressTracker.updateProgress(5, 'Initializing Vision API...', `Processing file ${progressTracker.fileIndex + 1} of ${progressTracker.totalFiles}`);
  
  if (!visionClient) {
    throw new Error('Vision API client not initialized');
  }
  
  try {
    progressTracker.updateProgress(20, 'Preparing image...', 'Loading image file');
    progressTracker.log('Vision API: Making API call...');
    
    progressTracker.updateProgress(40, 'Sending to Google Vision...', 'Uploading image for text detection');
    
    const [result] = await visionClient.textDetection(filePath);
    
    progressTracker.updateProgress(70, 'Processing results...', 'Extracting text from image');
    
    let fullText = '';
    let confidence = 0;
    
    if (result.error) {
      throw new Error(`Vision API error: ${result.error.message}`);
    }
    
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      fullText = result.textAnnotations[0].description || '';
      confidence = result.textAnnotations[0].score || 0;
      progressTracker.log(`Vision API: Extracted ${fullText.length} characters`);
    }
    
    progressTracker.updateProgress(90, 'Text extraction complete', `Found ${fullText.length} characters with ${(confidence * 100).toFixed(1)}% confidence`);
    
    return {
      text: fullText,
      confidence: confidence,
      provider: 'vision-api',
      processingTime: Date.now()
    };
    
  } catch (error) {
    progressTracker.log('Vision API processing error: ' + error.message);
    throw error;
  }
}

/**
 * Extract text from file with enhanced progress tracking
 */
async function extractTextFromFile(filePath, fileIndex = 0, totalFiles = 1, progressCallback = null) {
  const progressTracker = new ProgressTracker(fileIndex, totalFiles, progressCallback);
  
  progressTracker.log(`=== Smart OCR: Processing file ${filePath} ===`);
  progressTracker.updateProgress(1, 'Starting file processing...', `File ${fileIndex + 1} of ${totalFiles}`);
  
  // Detect file type
  const fileType = detectFileType(filePath);
  progressTracker.log(`Smart OCR: Detected file type: ${fileType}`);
  
  let ocrResult;
  
  if (fileType === 'pdf') {
    ocrResult = await processPdfWithDocumentAI(filePath, progressTracker);
  } else if (fileType === 'image') {
    ocrResult = await processImageWithVision(filePath, progressTracker);
  } else {
    throw new Error(`Unsupported file type: ${fileType}`);
  }
  
  progressTracker.updateProgress(95, 'Processing complete', `Successfully processed ${fileType} file`);
  progressTracker.log(`Smart OCR: Completed using ${ocrResult.provider}`);
  
  return ocrResult;
}

/**
 * Parse biomarkers with progress tracking
 */
function parseLabValues(text, progressTracker) {
  if (progressTracker) {
    progressTracker.updateProgress(96, 'Parsing biomarkers...', 'Analyzing extracted text for lab values');
    progressTracker.log('Smart OCR: Starting biomarker parsing with universal parser...');
  } else {
    console.log('Smart OCR: Starting biomarker parsing with universal parser...');
  }
  
  if (!text || text.length === 0) {
    console.log('Smart OCR: No text provided for parsing');
    return {};
  }
  
  // Try to use the shared universal parser first
  try {
    const { parseUniversalBiomarkers } = require('../biomarkerParser');
    const results = parseUniversalBiomarkers(text);
    
    if (Object.keys(results).length > 0) {
      const message = `Smart OCR: Universal parser found ${Object.keys(results).length} biomarkers`;
      if (progressTracker) {
        progressTracker.log(message);
        progressTracker.updateProgress(98, 'Biomarker extraction complete', `Found ${Object.keys(results).length} lab values`);
      } else {
        console.log(message);
      }
      return results;
    }
  } catch (error) {
    console.log('Smart OCR: Universal parser not available, using fallback:', error.message);
  }
  
  // Fallback to basic patterns if universal parser fails
  return parseBasicPatterns(text);
}

/**
 * Enhanced extractFromPDF with proper progress tracking
 */
async function extractFromPDF(filePath, fileIndex = 0, totalFiles = 1, progressCallback = null) {
  const progressTracker = progressCallback ? new ProgressTracker(fileIndex, totalFiles, progressCallback) : null;
  
  if (progressTracker) {
    progressTracker.log(`=== Smart OCR: Starting lab extraction for ${filePath} ===`);
  } else {
    console.log(`=== Smart OCR: Starting lab extraction for ${filePath} ===`);
  }
  
  try {
    // Extract text using smart routing with progress
    const ocrResult = await extractTextFromFile(filePath, fileIndex, totalFiles, progressCallback);
    
    // Parse biomarkers from the extracted text
    if (progressTracker) {
      progressTracker.log('Smart OCR: Starting biomarker parsing...');
    } else {
      console.log('Smart OCR: Starting biomarker parsing...');
    }
    
    const labValues = parseLabValues(ocrResult.text, progressTracker);
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
    const finalMessage = `Smart OCR: Extraction completed using ${ocrResult.provider}`;
    
    if (progressTracker) {
      progressTracker.log(finalMessage);
      progressTracker.log(`Smart OCR: Found ${labCount} biomarkers`);
      progressTracker.log(`Smart OCR: Text length: ${ocrResult.text.length} characters`);
      progressTracker.log(`Smart OCR: Confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`);
      progressTracker.updateProgress(100, 'File processing complete!', `Successfully extracted ${labCount} biomarkers`);
    } else {
      console.log(finalMessage);
      console.log(`Smart OCR: Found ${labCount} biomarkers`);
      console.log(`Smart OCR: Text length: ${ocrResult.text.length} characters`);
      console.log(`Smart OCR: Confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`);
    }
    
    if (labCount > 0) {
      const biomarkerList = `Smart OCR: Biomarkers found: ${JSON.stringify(Object.keys(labValues))}`;
      if (progressTracker) {
        progressTracker.log(biomarkerList);
      } else {
        console.log(biomarkerList);
      }
    }
    
    return result;
    
  } catch (error) {
    const errorMessage = 'Smart OCR extraction failed: ' + error.message;
    if (progressTracker) {
      progressTracker.log(errorMessage);
    } else {
      console.error(errorMessage);
    }
    
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

// Helper functions (kept the same)
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

function parseBasicPatterns(text) {
  console.log('Smart OCR: Using basic pattern fallback...');
  return {}; // Implement basic fallback if needed
}

function extractTestDate(text) {
  console.log('Smart OCR: Extracting test date...');
  
  if (!text || typeof text !== 'string') {
    return new Date();
  }
  
  // Try universal date extractor first
  try {
    const { extractUniversalTestDate } = require('../biomarkerParser');
    return extractUniversalTestDate(text);
  } catch (error) {
    console.log('Smart OCR: Universal date parser not available, using fallback');
  }
  
  return new Date();
}

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