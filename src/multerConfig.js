const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Detect if running on Vercel (serverless environment)
const isVercel = process.env.VERCEL || process.env.NOW_REGION;
const isDevelopment = process.env.NODE_ENV === 'development';

// Check if we're running locally (has local parsers available)
const isLocalEnvironment = !isVercel && fs.existsSync(path.join(__dirname, './parsers'));

console.log(`Environment: ${isVercel ? 'Vercel Production' : 'Local Development'}`);
console.log(`OCR Method: ${isLocalEnvironment ? 'Local PaddleOCR' : 'External OCR Service'}`);

// OCR Service URL for production - your Digital Ocean droplet
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL || 'http://147.182.149.140:8000';

// Import local parser only if available
let localExtractFromPDF = null;
if (isLocalEnvironment) {
  try {
    const localParser = require('./parsers');
    localExtractFromPDF = localParser.extractFromPDF;
    console.log('Local OCR parser loaded successfully');
  } catch (error) {
    console.log('Local OCR parser not available, will use external service');
  }
}

// Import external OCR dependencies only if needed
let FormData, fetch;
if (!isLocalEnvironment) {
  try {
    FormData = require('form-data');
    fetch = require('node-fetch');
    console.log('External OCR dependencies loaded');
  } catch (error) {
    console.error('External OCR dependencies not available:', error);
  }
}

// Configure storage based on environment
let storage;

if (isVercel) {
  // Production: Use memory storage for Vercel
  console.log('Using memory storage for Vercel deployment');
  storage = multer.memoryStorage();
} else {
  // Local development: Use disk storage
  console.log('Using disk storage for local development');
  storage = multer.diskStorage({
    destination: function (req, file, cb) {
      // Create uploads directory if it doesn't exist
      const uploadDir = path.join(__dirname, "../public/uploads");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      // Create unique filename with original extension
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  });
}

// File filter function (same for both environments)
const fileFilter = (req, file, cb) => {
  const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only PDF, JPEG, and PNG files are allowed."
      ),
      false
    );
  }
};

// Configure multer with environment-appropriate limits
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: isLocalEnvironment ? 200 * 1024 * 1024 : 50 * 1024 * 1024, // 200MB local, 50MB production
    files: isLocalEnvironment ? 20 : 5, // More files allowed locally
    fieldSize: 10 * 1024 * 1024, // 10MB for form fields
  },
});

// Helper function to handle file processing in both environments
async function processUploadedFile(file, extractFromPDF) {
  let filePath;
  let tempFilePath = null;
  
  try {
    if (isVercel) {
      // Memory storage: Create temporary file from buffer
      tempFilePath = `/tmp/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      fs.writeFileSync(tempFilePath, file.buffer);
      filePath = tempFilePath;
      
      console.log(`Created temp file for processing: ${tempFilePath}`);
      console.log(`Vercel environment: OCR processing disabled`);
    } else {
      // Disk storage: Use the file path directly
      filePath = file.path;
      console.log(`Processing file from disk: ${filePath}`);
    }
    
    // Process the file
    let extractedData;
    if (isVercel) {
      // In production, skip OCR processing but still save the file
      console.log('Vercel: Skipping OCR, saving file metadata only');
      extractedData = {
        labValues: {},
        testDate: new Date(),
        processingErrors: ['OCR processing is currently disabled in production environment']
      };
    } else {
      // In development, use full OCR processing
      extractedData = await extractFromPDF(filePath);
    }
    
    console.log("Extracted data:", {
      numLabValues: Object.keys(extractedData.labValues || {}).length,
      testDate: extractedData.testDate,
      hasErrors: !!(extractedData.processingErrors && extractedData.processingErrors.length > 0)
    });
    
    // Create file object for database
    const fileObject = {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      path: isVercel ? null : (file.path || null),
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date(),
      testDate: extractedData.testDate ? new Date(extractedData.testDate) : null,
      labValues: extractedData.labValues || {},
      extractionMethod: "paddleocr",
      processingErrors: extractedData.processingErrors || []
    };
    
    return fileObject;
    
  } catch (error) {
    console.error(`Error processing file ${file.originalname}:`, error);
    throw error;
  } finally {
    // Clean up temporary file if created
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up temp file ${tempFilePath}:`, cleanupError.message);
      }
    }
  }
}

// Local OCR processing (original method)
async function processWithLocalOCR(file, extractFromPDF) {
  let tempFilePath = null;
  
  try {
    console.log(`Processing file locally: ${file.originalname}`);
    
    let filePath;
    
    if (isVercel) {
      // Memory storage: Create temporary file from buffer
      tempFilePath = `/tmp/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      fs.writeFileSync(tempFilePath, file.buffer);
      filePath = tempFilePath;
    } else {
      // Disk storage: Use the file path directly
      filePath = file.path;
    }
    
    // Process the file with local OCR
    const extractedData = await extractFromPDF(filePath);
    
    console.log("Local OCR extracted data:", {
      numLabValues: Object.keys(extractedData.labValues || {}).length,
      testDate: extractedData.testDate,
    });
    
    // Create file object for database
    const fileObject = {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      path: isVercel ? null : file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date(),
      testDate: extractedData.testDate ? new Date(extractedData.testDate) : null,
      labValues: extractedData.labValues || {},
      extractionMethod: "local_paddleocr",
      processingErrors: [],
    };
    
    return fileObject;
    
  } catch (error) {
    console.error(`Error processing file locally ${file.originalname}:`, error);
    throw error;
  } finally {
    // Clean up temporary file if created
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up temp file ${tempFilePath}:`, cleanupError.message);
      }
    }
  }
}

// External OCR processing (for production)
async function processWithExternalOCR(file) {
  let tempFilePath = null;
  
  try {
    console.log(`Processing file with external OCR: ${file.originalname}`);
    
    // Prepare file for OCR service
    let fileBuffer;
    
    if (isVercel) {
      // Memory storage: use buffer directly
      fileBuffer = file.buffer;
      
      // Create temporary file for form data
      tempFilePath = `/tmp/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      fs.writeFileSync(tempFilePath, file.buffer);
    } else {
      // Disk storage: read the file
      fileBuffer = fs.readFileSync(file.path);
    }
    
    // Send file to OCR service
    const ocrResult = await callExternalOCRService(fileBuffer, file.originalname, file.mimetype);
    
    console.log("External OCR processing completed:", {
      success: ocrResult.success,
      textLength: ocrResult.text ? ocrResult.text.length : 0,
      labValuesCount: ocrResult.lab_values ? Object.keys(ocrResult.lab_values).length : 0
    });
    
    // Convert OCR result to expected format
    const extractedData = {
      labValues: ocrResult.lab_values || {},
      testDate: ocrResult.test_date ? new Date(ocrResult.test_date) : new Date()
    };
    
    // Create file object for database
    const fileObject = {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      path: isVercel ? null : file.path,
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date(),
      testDate: extractedData.testDate,
      labValues: extractedData.labValues,
      extractionMethod: "external_ocr_service",
      processingErrors: ocrResult.success ? [] : [ocrResult.error || 'OCR processing failed'],
      ocrResponse: {
        service: 'digital_ocean',
        textLength: ocrResult.text ? ocrResult.text.length : 0,
        processedAt: new Date().toISOString()
      }
    };
    
    return fileObject;
    
  } catch (error) {
    console.error(`Error processing file with external OCR ${file.originalname}:`, error);
    
    // Return file object with error info
    return {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      path: isVercel ? null : (file.path || null),
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date(),
      testDate: new Date(),
      labValues: {},
      extractionMethod: "external_ocr_failed",
      processingErrors: [error.message],
      ocrResponse: {
        service: 'digital_ocean',
        error: error.message,
        processedAt: new Date().toISOString()
      }
    };
  } finally {
    // Clean up temporary file if created
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.warn(`Warning: Could not clean up temp file ${tempFilePath}:`, cleanupError.message);
      }
    }
  }
}

// Function to call the external OCR service
async function callExternalOCRService(fileBuffer, filename, mimetype) {
  try {
    if (!FormData || !fetch) {
      throw new Error('External OCR dependencies not available');
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: mimetype,
    });
    formData.append('parse', 'true'); // Request parsing, not just text extraction
    
    console.log(`Calling external OCR service: ${OCR_SERVICE_URL}/parse`);
    
    // Call the OCR service
    const response = await fetch(`${OCR_SERVICE_URL}/parse`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 120000, // 2 minute timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OCR service returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    return result;
    
  } catch (error) {
    console.error('External OCR service call failed:', error);
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error('External OCR service is not available');
    } else if (error.message.includes('timeout')) {
      throw new Error('OCR processing timed out');
    } else {
      throw error;
    }
  }
}

// Test connectivity based on environment
async function testOCRService() {
  if (isLocalEnvironment && localExtractFromPDF) {
    console.log('Local OCR parser is available');
    return true;
  } else if (!isLocalEnvironment && fetch) {
    try {
      console.log(`Testing external OCR service connectivity: ${OCR_SERVICE_URL}/health`);
      const response = await fetch(`${OCR_SERVICE_URL}/health`, {
        timeout: 10000 // 10 second timeout for health check
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('External OCR service is healthy:', result);
        return true;
      } else {
        console.error('External OCR service health check failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('External OCR service connectivity test failed:', error.message);
      return false;
    }
  } else {
    console.warn('No OCR method available');
    return false;
  }
}

// Test connectivity on startup
testOCRService();

// Error handler for multer errors (enhanced for both environments)
const multerErrorHandler = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error.code, error.message);
    
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        const maxSize = isLocalEnvironment ? "200MB" : "50MB";
        return res.status(400).json({
          success: false,
          message: `File is too large. Maximum size is ${maxSize}.`,
          errorCode: 'FILE_TOO_LARGE'
        });
      case "LIMIT_FILE_COUNT":
        const maxFiles = isLocalEnvironment ? "20" : "5";
        return res.status(400).json({
          success: false,
          message: `Too many files. Maximum is ${maxFiles} files per upload.`,
          errorCode: 'TOO_MANY_FILES'
        });
      case "LIMIT_UNEXPECTED_FILE":
        return res.status(400).json({
          success: false,
          message: "Unexpected file field.",
          errorCode: 'UNEXPECTED_FILE'
        });
      default:
        return res.status(400).json({
          success: false,
          message: error.message,
          errorCode: 'UPLOAD_ERROR'
        });
    }
  }
  
  // Handle file filter errors
  if (error.message && error.message.includes("Invalid file type")) {
    return res.status(400).json({
      success: false,
      message: "Invalid file type. Only PDF, JPEG, and PNG files are allowed.",
      errorCode: 'INVALID_FILE_TYPE'
    });
  }
  
  next(error);
};

// Export configured multer and helper functions
module.exports = {
  upload,
  processUploadedFile,
  multerErrorHandler,
  isVercel,
  isDevelopment,
  isLocalEnvironment,
  testOCRService
};