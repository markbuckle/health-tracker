const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Detect if running on Vercel (serverless environment)
const isVercel = process.env.VERCEL || process.env.NOW_REGION;
const isProductionEnv = process.env.NODE_ENV === 'production';

console.log(`Environment: ${isVercel ? 'Vercel Production' : 'Local Development'}`);

// Only use external OCR service if explicitly configured and not in production
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL; // Remove the fallback URL
const useExternalOCR = OCR_SERVICE_URL && !isVercel && !isProductionEnv;

// External OCR service connectivity test
if (useExternalOCR) {
  console.log('External OCR service configured for development environment');
  
  const testConnectivity = async () => {
    try {
      console.log(`Testing external OCR service connectivity: ${OCR_SERVICE_URL}/health`);
      const fetch = require('node-fetch');
      const response = await fetch(`${OCR_SERVICE_URL}/health`, { 
        timeout: 5000 
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('External OCR service is healthy:', data);
      } else {
        console.error('External OCR service health check failed:', response.status);
      }
    } catch (error) {
      console.error('External OCR service connectivity test failed:', error.message);
    }
  };

  testConnectivity();
} else {
  console.log('External OCR service disabled in production environment');
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
    fileSize: isVercel ? 100 * 1024 * 1024 : 200 * 1024 * 1024, // 100MB on Vercel, 200MB locally
    files: isVercel ? 8 : 20, // Limit concurrent files on Vercel
    fieldSize: 10 * 1024 * 1024, // 10MB for form fields
  },
});

// Helper function to handle file processing in both environments
async function processUploadedFile(file, extractFromPDF) {
  let filePath;
  let tempFilePath = null;
  
  try {
    if (isVercel) {
      // Production: Use Digital Ocean OCR service
      console.log('Vercel environment: Using Digital Ocean OCR service');
      
      const extractedData = await processWithDigitalOceanOCR(file);
      
      console.log("Extracted data:", {
        numLabValues: Object.keys(extractedData.labValues || {}).length,
        testDate: extractedData.testDate,
        hasErrors: !!(extractedData.processingErrors && extractedData.processingErrors.length > 0)
      });
      
      // Create file object for database
      const fileObject = {
        filename: file.filename || file.originalname,
        originalName: file.originalname,
        path: null, // Always null in Vercel
        size: file.size,
        mimetype: file.mimetype,
        uploadDate: new Date(),
        testDate: extractedData.testDate || new Date(),
        labValues: extractedData.labValues || {},
        extractionMethod: 'digital-ocean-ocr',
        processingErrors: extractedData.processingErrors || []
      };
      
      return fileObject;
      
    } else {
      // Local development: Use existing logic
      filePath = file.path;
      console.log(`Processing file from disk: ${filePath}`);
      
      const extractedData = await extractFromPDF(filePath);
      
      console.log("Extracted data:", {
        numLabValues: Object.keys(extractedData.labValues || {}).length,
        testDate: extractedData.testDate,
        hasErrors: !!(extractedData.processingErrors && extractedData.processingErrors.length > 0)
      });
      
      // Create file object for database
      const fileObject = {
        filename: file.filename || file.originalname,
        originalName: file.originalname,
        path: file.path || null,
        size: file.size,
        mimetype: file.mimetype,
        uploadDate: new Date(),
        testDate: extractedData.testDate || new Date(),
        labValues: extractedData.labValues || {},
        extractionMethod: 'local-ocr',
        processingErrors: extractedData.processingErrors || []
      };
      
      return fileObject;
    }
    
  } catch (error) {
    console.error('File processing error:', error);
    throw error;
  } finally {
    // Clean up temp file only in local environment
    if (tempFilePath && !isVercel) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
  }
}

// Add this new function to call your Digital Ocean OCR service
async function processWithDigitalOceanOCR(file) {
  const fetch = require('node-fetch');
  const FormData = require('form-data');
  
  try {
    console.log(`Sending file to Digital Ocean OCR: ${file.originalname}`);
    
    // Create form data for the Digital Ocean OCR service
    const formData = new FormData();
    
    // Convert buffer to a readable stream
    const { Readable } = require('stream');
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);
    
    formData.append('file', bufferStream, {
      filename: file.originalname,
      contentType: file.mimetype,
    });
    
    // Call Digital Ocean OCR service directly
    const response = await fetch('http://147.182.149.140:8000/parse', {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
      timeout: 120000, // 2 minute timeout
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Digital Ocean OCR error:', errorText);
      throw new Error(`OCR service returned ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('Digital Ocean OCR processing completed successfully');
    console.log('OCR Result:', {
      success: result.success,
      lab_values_count: Object.keys(result.lab_values || {}).length,
      has_text: !!result.text,
      test_date: result.test_date
    });
    
    return {
      labValues: result.lab_values || {},
      testDate: result.test_date ? new Date(result.test_date) : new Date(),
      extractionMethod: 'digital-ocean-ocr',
      processingErrors: result.success ? [] : [result.error || 'OCR processing failed'],
      rawText: result.text || ''
    };
    
  } catch (error) {
    console.error('Error calling Digital Ocean OCR:', error);
    
    // Fallback: save file without OCR but indicate the error
    return {
      labValues: {},
      testDate: new Date(),
      extractionMethod: 'failed',
      processingErrors: [`Digital Ocean OCR failed: ${error.message}`]
    };
  }
}

// Error handler for multer errors (enhanced for both environments)
const multerErrorHandler = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('Multer error:', error.code, error.message);
    
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        const maxSize = isVercel ? "100MB" : "200MB";
        return res.status(400).json({
          success: false,
          message: `File is too large. Maximum size is ${maxSize}.`,
          errorCode: 'FILE_TOO_LARGE'
        });
      case "LIMIT_FILE_COUNT":
        const maxFiles = isVercel ? "8" : "20";
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
  isProductionEnv
};