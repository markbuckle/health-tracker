// src/parsers/GoogleVision/smartOcrRouter.js - MINIMAL FIX for biomarker parsing

const vision = require('@google-cloud/vision');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const fs = require('fs');
const path = require('path');
const { visionConfig } = require('./config');

// Initialize both clients
let visionClient;
let documentAIClient;

try {
  visionClient = new vision.ImageAnnotatorClient(visionConfig);
  console.log('Google Cloud Vision client initialized successfully');
  
  documentAIClient = new DocumentProcessorServiceClient(visionConfig);
  console.log('Google Document AI client initialized successfully');
} catch (error) {
  console.error('Failed to initialize Google Cloud clients:', error.message);
}

/**
 * Progress tracking class
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
    if (global.wsInstance) {
      global.wsInstance.send(message);
    }
  }
}

/**
 * FIXED: Biomarker parser with working patterns
 */
function parseLabValues(text, progressTracker) {
  if (progressTracker) {
    progressTracker.updateProgress(96, 'Parsing biomarkers...', 'Analyzing extracted text for lab values');
    progressTracker.log('Smart OCR: Starting biomarker parsing...');
  } else {
    console.log('Smart OCR: Starting biomarker parsing...');
  }
  
  if (!text || text.length === 0) {
    console.log('Smart OCR: No text provided for parsing');
    return {};
  }

  // FIXED: Use the working biomarker parser from your project
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
    console.log('Smart OCR: Universal parser error:', error.message);
  }
  
  // FIXED: Enhanced fallback patterns based on your sample document
  console.log('Smart OCR: Using enhanced fallback patterns...');
  const results = {};
  
  // Enhanced patterns for the specific format in your lab report
  const enhancedPatterns = {
    'Glucose': {
      regex: /Glucose\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)/i,
      unit: 'mg/dL'
    },
    'Total Cholesterol': {
      regex: /Total Cholesterol\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)/i,
      unit: 'mg/dL'
    },
    'HDL Cholesterol': {
      regex: /HDL Cholesterol\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)/i,
      unit: 'mg/dL'
    },
    'LDL Cholesterol': {
      regex: /LDL Cholesterol\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)/i,
      unit: 'mg/dL'
    },
    'Triglycerides': {
      regex: /Triglycerides\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)/i,
      unit: 'mg/dL'
    },
    'Hemoglobin': {
      regex: /Hemoglobin\s+(\d+\.?\d*)\s+g\/dL\s+([\d\.\s\-<>]+)/i,
      unit: 'g/dL'
    },
    'Hematocrit': {
      regex: /Hematocrit\s+(\d+\.?\d*)\s+%\s+([\d\.\s\-<>]+)/i,
      unit: '%'
    },
    'Creatinine': {
      regex: /Creatinine\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)/i,
      unit: 'mg/dL'
    },
    'eGFR': {
      regex: /eGFR\s+(>?\d+\.?\d*)\s+mL\/min\/1\.73m²\s+([\d\.\s\-<>]*)/i,
      unit: 'mL/min/1.73m²'
    },
    'TSH': {
      regex: /TSH\s+(\d+\.?\d*)\s+mIU\/L\s+([\d\.\s\-<>]+)/i,
      unit: 'mIU/L'
    }
  };

  // Search for patterns
  let matchCount = 0;
  for (const [biomarkerName, pattern] of Object.entries(enhancedPatterns)) {
    try {
      const match = pattern.regex.exec(text);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        const referenceRange = (match[2] && match[2].trim()) ? match[2].trim() : null;
        
        if (!isNaN(value)) {
          console.log(`Smart OCR: Found ${biomarkerName} = ${value} ${pattern.unit}${referenceRange ? ` (Range: ${referenceRange})` : ''}`);
          
          results[biomarkerName] = {
            value: value,
            unit: pattern.unit,
            rawText: match[0].trim(),
            referenceRange: referenceRange,
            confidence: 0.8,
            source: 'enhanced-fallback'
          };
          matchCount++;
        }
      }
    } catch (error) {
      console.error(`Smart OCR: Error parsing ${biomarkerName}:`, error.message);
    }
  }
  
  console.log(`Smart OCR: Enhanced fallback found ${matchCount} biomarkers`);
  
  if (progressTracker && matchCount > 0) {
    progressTracker.updateProgress(98, 'Biomarker extraction complete', `Found ${matchCount} lab values`);
  }
  
  return results;
}

/**
 * Main extraction function
 */
async function extractFromPDF(filePath, fileIndex = 0, totalFiles = 1, progressCallback = null) {
  // Parameter validation
  if (!filePath || typeof filePath !== 'string') {
    throw new Error(`Invalid filePath parameter: expected string, got ${typeof filePath} with value: ${filePath}`);
  }
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }
  
  const progressTracker = new ProgressTracker(fileIndex, totalFiles, progressCallback);
  progressTracker.log(`=== Smart OCR: Starting lab extraction for ${filePath} ===`);
  
  try {
    // Extract text using smart routing with progress
    const ocrResult = await extractTextFromFile(filePath, fileIndex, totalFiles, progressCallback);
    
    // Parse biomarkers from the extracted text
    progressTracker.log('Smart OCR: Starting biomarker parsing...');
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
    
    progressTracker.log(finalMessage);
    progressTracker.log(`Smart OCR: Found ${labCount} biomarkers`);
    progressTracker.log(`Smart OCR: Text length: ${ocrResult.text.length} characters`);
    progressTracker.log(`Smart OCR: Confidence: ${(ocrResult.confidence * 100).toFixed(1)}%`);
    progressTracker.updateProgress(100, 'File processing complete!', `Successfully extracted ${labCount} biomarkers`);
    
    if (labCount > 0) {
      progressTracker.log(`Smart OCR: Biomarkers found: ${JSON.stringify(Object.keys(labValues))}`);
    }
    
    return result;
    
  } catch (error) {
    const errorMessage = 'Smart OCR extraction failed: ' + error.message;
    progressTracker.log(errorMessage);
    
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
 * Extract text from file
 */
async function extractTextFromFile(filePath, fileIndex = 0, totalFiles = 1, progressCallback = null) {
  const progressTracker = new ProgressTracker(fileIndex, totalFiles, progressCallback);
  
  progressTracker.log(`=== Smart OCR: Processing file ${filePath} ===`);
  progressTracker.updateProgress(1, 'Starting file processing...', `File ${fileIndex + 1} of ${totalFiles}`);
  
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
  progressTracker.log(`Smart OCR: Text extraction complete - ${ocrResult.text.length} characters`);
  
  return ocrResult;
}

/**
 * Process PDF using Document AI
 */
async function processPdfWithDocumentAI(filePath, progressTracker) {
  progressTracker.log('Smart OCR: Using Document AI for PDF processing');
  progressTracker.updateProgress(5, 'Initializing Document AI...', `Processing file`);
  
  if (!documentAIClient) {
    throw new Error('Document AI client not initialized');
  }
  
  try {
    progressTracker.updateProgress(10, 'Reading PDF file...', 'Loading document into memory');
    const fileContent = fs.readFileSync(filePath);
    
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = process.env.DOCUMENT_AI_LOCATION || 'us'; 
    const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;
    
    if (!processorId) {
      throw new Error('DOCUMENT_AI_PROCESSOR_ID not configured');
    }
    
    const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const request = {
      name: processorName,
      rawDocument: {
        content: fileContent,
        mimeType: 'application/pdf'
      }
    };
    
    progressTracker.updateProgress(30, 'Processing with Document AI...', 'Extracting text');
    
    const [result] = await documentAIClient.processDocument(request);
    
    let fullText = '';
    let totalConfidence = 0;
    let blockCount = 0;
    
    if (result.document && result.document.text) {
      fullText = result.document.text;
      
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
 * Process image using Vision API
 */
async function processImageWithVision(filePath, progressTracker) {
  progressTracker.log('Smart OCR: Using Vision API for image processing');
  
  if (!visionClient) {
    throw new Error('Vision API client not initialized');
  }
  
  try {
    const [result] = await visionClient.textDetection(filePath);
    
    let fullText = '';
    let confidence = 0;
    
    if (result.error) {
      throw new Error(`Vision API error: ${result.error.message}`);
    }
    
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      fullText = result.textAnnotations[0].description || '';
      confidence = result.textAnnotations[0].score || 0;
    }
    
    return {
      text: fullText,
      confidence: confidence,
      provider: 'vision-api',
      processingTime: Date.now()
    };
    
  } catch (error) {
    throw error;
  }
}

// Helper functions
function detectFileType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return extension === '.pdf' ? 'pdf' : 'image';
}

function extractTestDate(text) {
  if (!text || typeof text !== 'string') {
    return new Date();
  }
  
  try {
    const { extractUniversalTestDate } = require('../biomarkerParser');
    return extractUniversalTestDate(text);
  } catch (error) {
    console.log('Smart OCR: Universal date parser not available, using fallback');
  }
  
  return new Date();
}

module.exports = {
  extractFromPDF,
  extractTextFromFile,
  parseLabValues,
  extractTestDate,
  processPdfWithDocumentAI,
  processImageWithVision
};