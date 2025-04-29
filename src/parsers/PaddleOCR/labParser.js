// PaddleOCR implementation for lab documents

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { labPatterns, datePatterns } = require('../labPatterns');

/**
 * Detect document type based on file extension
 * @param {string} filePath - Path to the file
 * @returns {string} Document type ('pdf', 'image', or 'unknown')
 */
function detectDocumentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.pdf') {
    return 'pdf';
  } else if (['.jpg', '.jpeg', '.png'].includes(extension)) {
    return 'image';
  } else {
    return 'unknown';
  }
}

/**
 * Minimal preprocessing function to increase pixel density
 * @param {string} inputPath - Path to input file
 * @param {string} outputPath - Path to save preprocessed file
 * @returns {Promise<string>} Path to preprocessed file
 */
function preprocessImage(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    // Create destination directory if it doesn't exist
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Simply copy the file for now - actual preprocessing would be done in Python
    fs.copyFile(inputPath, outputPath, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(outputPath);
      }
    });
  });
}

/**
 * Extract lab values and test date from a PDF file
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted lab values and test date
 */
async function extractFromPDF(filePath) {
  try {
    console.log(`Processing PDF file: ${filePath}`);
    
    // Create a temp directory for extracted images
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Prepare output path for preprocessed file
    const processedPath = path.join(tempDir, path.basename(filePath));
    
    // Preprocess the file
    await preprocessImage(filePath, processedPath);
    
    // Run PaddleOCR to extract text
    const text = await runPaddleOCR(processedPath);
    
    // Parse lab values and test date
    const labValues = parseLabValues(text);
    let testDate = extractTestDate(text, filePath);
    
    // Try to extract date from filename if normal extraction failed
    if (!testDate || testDate.toString() === 'Invalid Date') {
      const filename = path.basename(filePath);
      console.log("Trying to extract date from filename:", filename);
      
      // Check for date format in the filename (09.16.2018)
      const dateMatch = filename.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (dateMatch) {
        const [_, month, day, year] = dateMatch;
        testDate = new Date(year, parseInt(month) - 1, parseInt(day));
        console.log(`Extracted date from filename: ${month}/${day}/${year}`);
      }
      
      // If still no valid date, use current date
      if (!testDate || testDate.toString() === 'Invalid Date') {
        console.log('Could not extract valid date, using current date as fallback');
        testDate = new Date();
      }
    }
    
    // Clean up temp file
    try {
      fs.unlinkSync(processedPath);
    } catch (err) {
      console.log(`Warning: Could not clean up temp file: ${err.message}`);
    }
    
    console.log("Found lab values:", Object.keys(labValues).length, "values");
    console.log("Lab values:", labValues);
    
    return {
      labValues,
      testDate
    };
  } catch (error) {
    console.error(`Error extracting from PDF: ${error}`);
    return {
      labValues: {},
      testDate: new Date() // Always return a valid date
    };
  }
}

/**
 * Extract lab values and test date from an image file
 * @param {string} filePath - Path to the image file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted lab values and test date
 */
async function extractFromImage(filePath) {
  try {
    console.log(`Processing image file: ${filePath}`);
    
    // Create a temp directory for processed images
    const tempDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    // Prepare output path for preprocessed file
    const processedPath = path.join(tempDir, path.basename(filePath));
    
    // Preprocess the file
    await preprocessImage(filePath, processedPath);
    
    // Run PaddleOCR to extract text
    const text = await runPaddleOCR(processedPath);
    
    // Parse lab values and test date
    const labValues = parseLabValues(text);
    let testDate = extractTestDate(text, filePath);
    
    // Clean up temp file
    try {
      fs.unlinkSync(processedPath);
    } catch (err) {
      console.log(`Warning: Could not clean up temp file: ${err.message}`);
    }

    // debug code:
    console.log("Found lab values:", Object.keys(labValues).length, "values");
    console.log("Lab values:", labValues);
    
    return {
      labValues,
      testDate: testDate || new Date()  // Always return a valid date
    };
  } catch (error) {
    console.error(`Error extracting from image: ${error}`);
    return {
      labValues: {},
      testDate: null
    };
  }
}

/**
 * Run the PaddleOCR Python script on a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} Extracted text
 */
function runPaddleOCR(filePath) {
  return new Promise((resolve, reject) => {
    // Update the Python script path
    const scriptPath = path.join(__dirname, 'paddle_ocr.py');
    
    // Run the Python script with the file path as an argument
    const command = `python ${scriptPath} "${filePath}"`;
    
    console.log(`Running command: ${command}`);
    
    exec(command, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`PaddleOCR error: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.warn(`PaddleOCR warnings: ${stderr}`);
      }
      
      resolve(stdout.trim());
    });
  });
}

/**
 * Parse lab values from OCR text
 * @param {string} text - OCR text
 * @returns {Object} Extracted lab values
 */
function parseLabValues(text) {
  const results = {};
  
  // Return empty results if no text
  if (!text) return results;
  
  // Normalize text for consistency
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const lines = text.split('\n');
  
  // Try to match common lab test patterns
  for (const [testName, pattern] of Object.entries(labPatterns)) {
    try {
      const match = pattern.regex.exec(normalizedText);
      if (match) {
        console.log(`Found match: ${testName} = ${match[1]}`);
        
        // Try to find reference range
        const refRangeMatch = normalizedText.match(new RegExp(`${testName}.*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`));
        
        results[testName] = {
          value: parseFloat(match[1]),
          unit: pattern.standardUnit,
          rawText: match[0].trim(),
          referenceRange: refRangeMatch ? refRangeMatch[1] : null,
          confidence: 0.8
        };
      }
    } catch (error) {
      console.error(`Error parsing ${testName}:`, error);
    }
  }
  
  // Try to find structured format (TEST NAME RESULT format)
  for (const line of lines) {
    if (line.includes('TEST NAME') && line.includes('RESULT') && line.includes('UNITS')) {
      const nextLine = lines[lines.indexOf(line) + 1];
      if (nextLine) {
        const parts = nextLine.split(/\s+/);
        const testName = parts[0];
        const value = parts.find(p => /^[\d.]+$/.test(p));
        const refRange = parts.find(p => /^\d+\.?\d*[-–]\d+\.?\d*$/.test(p));
        const unit = parts[parts.length - 1];

        if (testName && value) {
          console.log(`Found structured format match: ${testName} = ${value} ${unit}`);
          results[testName] = {
            value: parseFloat(value),
            unit: unit,
            rawText: nextLine.trim(),
            referenceRange: refRange,
            confidence: 0.9
          };
        }
      }
    }
  }
  
  return results;
}

/**
 * Extract test date from OCR text
 * @param {string} text - OCR text
 * @returns {Date|null} Extracted test date
 */
function extractTestDate(text, filePath) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  // Add direct search for Collection Date in the OCR text
  // This is the most important change - look for the date format shown in your PDF
  console.log("Searching for Collection Date pattern in text");
  const collectionDatePattern = /Collection Date:?\s*(\d{4}-[A-Za-z]{3}-\d{1,2})/i;
  const collectionMatch = text.match(collectionDatePattern);
  if (collectionMatch) {
    try {
      const dateStr = collectionMatch[1];
      console.log("Found collection date string:", dateStr);
      const [year, month, day] = dateStr.split('-');
      const monthMap = {
        'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
      };
      const monthIndex = monthMap[month.toLowerCase()];
      const date = new Date(parseInt(year), monthIndex, parseInt(day));
      console.log(`Found collection date: ${year}-${month}-${day}`);
      return date;
    } catch (error) {
      console.log(`Error parsing collection date: ${error}`);
    }
  }

  // Sort date patterns by priority
  const sortedPatterns = [...datePatterns].sort((a, b) => a.priority - b.priority);

  for (const pattern of sortedPatterns) {
    const match = pattern.regex.exec(text);
    if (match) {
      try {
        const dateStr = match[1].trim();
        
        // Handle various date formats
        if (dateStr.includes('-')) {
          // Try to parse YYYY-MM-DD or DD-MM-YYYY
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            if (parts[0].length === 4) {
              // YYYY-MM-DD
              return new Date(parts[0], parts[1] - 1, parts[2]);
            } else {
              // DD-MM-YYYY
              return new Date(parts[2], parts[1] - 1, parts[0]);
            }
          }
        } else if (dateStr.includes('/')) {
          // Try to parse MM/DD/YYYY or DD/MM/YYYY
          const parts = dateStr.split('/');
          if (parts.length === 3) {
            // Assume MM/DD/YYYY format in the US
            return new Date(parts[2], parts[0] - 1, parts[1]);
          }
        }
        
        // Fall back to just trying to parse the date string directly
        const fallbackDate = new Date(dateStr);
        if (!isNaN(fallbackDate.getTime())) {
          return fallbackDate;
        }
      } catch (error) {
        console.log(`Error parsing date: ${error}`);
      }
    }
  }

  // Try to extract date from filename if provided
  if (filePath) {
    const fileNameMatch = path.basename(filePath).match(/(\d{2})\.(\d{2})\.(\d{4})/);
    // const fileNameMatch = path.basename(filePath).match(/(\d{2}\.\d{2}\.\d{4}|\d{4}-\d{2}-\d{2})/);
    if (fileNameMatch) {
      const [_, month, day, year] = fileNameMatch;
      console.log(`Extracted date from filename: ${month}/${day}/${year}`);
      return new Date(year, parseInt(month) - 1, day);
    }
    
    // For date formats like "2018-Sept-14" or similar text-month formats
    const collectionDatePattern = /Collection Date:\s*(\d{4}-[A-Za-z]{3}-\d{1,2})/i;
    const match = text.match(collectionDatePattern);
    if (match) {
      try {
        const dateStr = match[1];
        const [year, month, day] = dateStr.split('-');
        const monthMap = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };
        const monthIndex = monthMap[month.toLowerCase()];
        const date = new Date(parseInt(year), monthIndex, parseInt(day));
        console.log(`Found collection date: ${year}-${month}-${day}`);
        return date;
      } catch (error) {
        console.log(`Error parsing collection date: ${error}`);
      }
    }
  }
  
  // Return null if no date found
  return null;
}

/**
 * Main extraction function that detects document type and processes accordingly
 * @param {string} filePath - Path to the file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted lab values and test date
 */
async function extractFromPDFWrapper(filePath) {
  const docType = detectDocumentType(filePath);
  
  if (docType === 'pdf') {
    return extractFromPDF(filePath);
  } else if (docType === 'image') {
    return extractFromImage(filePath);
  } else {
    console.error(`Unsupported file type: ${path.extname(filePath)}`);
    return {
      labValues: {},
      testDate: null
    };
  }
}

module.exports = {
  extractFromPDF: extractFromPDFWrapper,
  parseLabValues,
  extractTestDate
};