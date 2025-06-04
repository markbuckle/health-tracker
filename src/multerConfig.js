const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Detect if running on Vercel (serverless environment)
const isVercel = process.env.VERCEL || process.env.NOW_REGION;
const isDevelopment = process.env.NODE_ENV === 'development';

console.log(`Environment: ${isVercel ? 'Vercel Production' : 'Local Development'}`);

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
      // Memory storage: Create temporary file from buffer
      tempFilePath = `/tmp/${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
      fs.writeFileSync(tempFilePath, file.buffer);
      filePath = tempFilePath;
      
      console.log(`Created temp file for processing: ${tempFilePath}`);
    } else {
      // Disk storage: Use the file path directly
      filePath = file.path;
      console.log(`Processing file from disk: ${filePath}`);
    }
    
    // Process the file (same for both environments)
    const extractedData = await extractFromPDF(filePath);
    
    console.log("Extracted data:", {
      numLabValues: Object.keys(extractedData.labValues || {}).length,
      testDate: extractedData.testDate,
    });
    
    // Create file object for database (adjusted for environment)
    const fileObject = {
      filename: file.filename || file.originalname, // filename exists in disk storage
      originalName: file.originalname,
      path: isVercel ? null : file.path, // Don't store path for memory storage
      size: file.size,
      mimetype: file.mimetype,
      uploadDate: new Date(),
      testDate: extractedData.testDate ? new Date(extractedData.testDate) : null,
      labValues: extractedData.labValues || {},
      extractionMethod: "paddleocr",
      processingErrors: [],
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
  isDevelopment
};