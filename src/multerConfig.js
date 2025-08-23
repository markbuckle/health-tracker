// src/multerConfig.js - FIXED VERSION with proper file path handling
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Detect if running on Vercel (serverless environment)
const isVercel = process.env.VERCEL || process.env.NOW_REGION;
const isProductionEnv = process.env.NODE_ENV === 'production';

console.log(`Environment: ${isVercel ? 'Vercel Production' : 'Local Development'}`);

// Import OCR parser - FIXED TO USE MAIN PARSER INDEX
let extractFromPDFFunction;
try {
  // Import the main parser which handles the implementation switching
  const mainParser = require('./parsers/index');
  extractFromPDFFunction = mainParser.extractFromPDF;
  console.log('✅ OCR parser loaded successfully from main index');
} catch (error) {
  console.error('❌ Failed to load OCR parser:', error.message);
  // Fallback function to prevent crashes
  extractFromPDFFunction = async (filePath) => {
    console.error('OCR parser not available, returning empty result');
    return {
      labValues: {},
      testDate: new Date(),
      rawText: '',
      confidence: 0,
      provider: 'not-available',
      processingErrors: ['OCR parser not available']
    };
  };
}

const { processBiomarkersForStorage } = require('./utilities/biomarkerProcessor');

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

// FIXED: Helper function to handle file processing in both environments
async function processUploadedFile(file, extractFromPDF, fileIndex = 0, totalFiles = 1, progressCallback = null) {
  let filePath;
  let tempFilePath = null;
  
  try {
    console.log(`🔄 Processing file ${fileIndex + 1} of ${totalFiles}: ${file.originalname}`);
    
    if (isVercel) {
      // Production: Create temporary file from memory buffer
      console.log('📱 Vercel environment: Creating temporary file from buffer');
      
      if (!file.buffer) {
        throw new Error('File buffer is missing - check multer memory storage configuration');
      }
      
      // Create temporary file from memory buffer for Google Vision
      const tempDir = '/tmp';
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      tempFilePath = path.join(tempDir, uniqueSuffix + path.extname(file.originalname));
      
      // Write buffer to temp file
      fs.writeFileSync(tempFilePath, file.buffer);
      console.log(`✅ Created temp file for Vercel: ${tempFilePath} (${file.buffer.length} bytes)`);
      
      // Use the temporary file path
      filePath = tempFilePath;
      
    } else {
      // Local development: Use the file path from disk storage
      if (!file.path) {
        throw new Error('File path is missing - check multer disk storage configuration');
      }
      
      filePath = file.path;
      console.log(`💾 Local environment: Using disk file: ${filePath}`);
    }
    
    // Verify file exists before processing
    if (!fs.existsSync(filePath)) {
      throw new Error(`File does not exist at path: ${filePath}`);
    }
    
    const fileStats = fs.statSync(filePath);
    console.log(`📊 File stats: ${fileStats.size} bytes`);
    
    // Progress callback for logging
    const enhancedProgressCallback = (progress, status, substatus) => {
      console.log(`🔥 PROGRESS CALLBACK CALLED: ${progress.toFixed(1)} ${status} ${substatus || ''}`);
      if (progressCallback) {
        progressCallback(progress, status, substatus);
      }
    };
    
    // Call the correct OCR function with the file path
    console.log(`🚀 Calling OCR parser with file: ${filePath}`);
    const extractedData = await extractFromPDFFunction(filePath);
    console.log(`🔥 extractFromPDF called successfully`);
    
    // Process the biomarkers
    const processedLabValues = processBiomarkersForStorage(extractedData.labValues || {});
    
    // Create file object for database
    const fileObject = {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      path: isVercel ? null : filePath, // No persistent path in Vercel
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date(),
      testDate: extractedData.testDate || new Date(),
      labValues: processedLabValues,
      extractionMethod: isVercel ? 'google-vision-vercel' : 'google-vision-local',
      processingErrors: extractedData.processingErrors || [],
      biomarkerProcessingComplete: true,
      totalBiomarkersProcessed: Object.keys(processedLabValues).length
    };
    
    console.log(`✅ File processing completed successfully`);
    console.log(`📊 Extracted ${Object.keys(processedLabValues).length} biomarkers`);
    
    return fileObject;
    
  } catch (error) {
    console.error('❌ File processing error:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Return a failed file object instead of throwing
    return {
      filename: file.filename || file.originalname,
      originalName: file.originalname,
      path: isVercel ? null : (file.path || null),
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date(),
      testDate: null,
      labValues: {},
      extractionMethod: 'failed',
      processingErrors: [error.message],
      biomarkerProcessingComplete: false,
      totalBiomarkersProcessed: 0
    };
  } finally {
    // Clean up temp file in Vercel environment
    if (tempFilePath && isVercel && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log(`🧹 Cleaned up temp file: ${tempFilePath}`);
      } catch (cleanupError) {
        console.error('⚠️ Error cleaning up temp file:', cleanupError.message);
      }
    }
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
  
  console.error('Unexpected error in file upload:', error);
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