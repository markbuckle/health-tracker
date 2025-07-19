// PaddleOCR implementation for lab documents

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { labPatterns, datePatterns } = require('../labPatterns');
const { parseStructuredLabReport, extractStructuredDate } = require('./imageParser');

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
    // const dir = path.dirname(outputPath);
    // if (!fs.existsSync(dir)) {
    //   fs.mkdirSync(dir, { recursive: true });
    // }

    // ✅ Ensure output directory is in /tmp/ for Vercel
    const isVercel = process.env.VERCEL || process.env.NOW_REGION;
    
    if (isVercel) {
      // For Vercel, ensure we're using /tmp/
      const dir = path.dirname(outputPath);
      if (!dir.startsWith('/tmp/')) {
        const fileName = path.basename(outputPath);
        outputPath = path.join('/tmp/', fileName);
      }
    }
    
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
    // const tempDir = path.join(__dirname, 'temp');
    // if (!fs.existsSync(tempDir)) {
    //   fs.mkdirSync(tempDir, { recursive: true });
    // }

    // ✅ Fixed code - use /tmp/ in serverless environment
    const isVercel = process.env.VERCEL || process.env.NOW_REGION;

    // Create a temp directory in the appropriate location
    const tempDir = isVercel 
      ? '/tmp/paddle-ocr-temp' 
      : path.join(__dirname, 'temp');

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

    // Make sure we have a valid date by checking if it's Invalid Date
    if (!testDate || testDate.toString() === 'Invalid Date' || isNaN(testDate.getTime())) {
      testDate = new Date(); // Use current date as fallback
    }
    
    return {
      labValues,
      testDate: testDate || new Date()  // Always return a valid date
    };
  } catch (error) {
    console.error(`Error extracting from image: ${error}`);
    return {
      labValues,
      testDate
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

    let totalPages = 1;
    let currentPage = 0;
    let estimatedTimePerPage = 30000; // 30 seconds per page estimate
    let startTime = Date.now();
    let progressInterval;
    
    const process = exec(command, { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      // Clear the progress interval when done
      if (progressInterval) {
        clearInterval(progressInterval);
      }

      if (error) {
        console.error(`PaddleOCR error: ${error.message}`);
        console.error(`stderr: ${stderr}`);
        reject(error);
        return;
      }
        
      // Process stderr for page tracking information
      if (stderr) {
        const stderrLines = stderr.split('\n');
        
        stderrLines.forEach(line => {
          if (line.startsWith('TOTAL_PAGES:')) {
            totalPages = parseInt(line.split(':')[1]);
            console.log(`Processing document with ${totalPages} pages`);
            
            // Start estimated progress tracking
            progressInterval = setInterval(() => {
              const elapsedTime = Date.now() - startTime;
              const estimatedCurrentPage = Math.min(
                Math.floor(elapsedTime / estimatedTimePerPage) + 1,
                totalPages
              );
              
              if (estimatedCurrentPage > currentPage && estimatedCurrentPage <= totalPages) {
                currentPage = estimatedCurrentPage;
                console.log(`Processing page ${currentPage} of ${totalPages} (estimated)`);
              }
            }, 2000); // Update every 2 seconds
            
          } else if (line.startsWith('CURRENT_PAGE:')) {
            const actualPage = parseInt(line.split(':')[1]);
            currentPage = actualPage;
            console.log(`Processing page ${actualPage} of ${totalPages}`);
          } else if (line.trim() && !line.startsWith('TOTAL_PAGES:') && !line.startsWith('CURRENT_PAGE:')) {
            console.warn(`PaddleOCR warnings: ${line}`);
        }
    });
  }
  
      // Send final completion message
      console.log(`Completed processing ${totalPages} pages`);
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

  // First try the structured lab report parser for medical lab reports with tables
  const structuredResults = parseStructuredLabReport(text);
  
  // If we found structured results, use those
  if (Object.keys(structuredResults).length > 0) {
    console.log("Found structured lab report with tables, using specialized parser");
    return structuredResults;
  }
  
  // Otherwise, fall back to the original pattern matching approach
  const results = {};
  
  // Return empty results if no text
  if (!text) {
    console.log("NO TEXT PROVIDED - returning empty results");
    return results;
  }

  // NEW: Try to parse "Result X.XX (unit)" format first
  const resultFormatResults = parseResultFormat(text);
  Object.assign(results, resultFormatResults);
  
  if (Object.keys(resultFormatResults).length > 0) {
    console.log(`Found ${Object.keys(resultFormatResults).length} biomarkers using Result format`);
  }
  
  // Normalize text for consistency
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  const lines = text.split('\n');

  console.log("Normalized text:", normalizedText.substring(0, 200));
  console.log("Number of lines:", lines.length);
  
  // Try to match common lab test patterns
  for (const [testName, pattern] of Object.entries(labPatterns)) {
    // Skip if we already found this biomarker using Result format
    if (results[testName]) {
      continue;
    }

    try {
      const match = pattern.regex.exec(normalizedText);
      if (match) {
        console.log(`Found match: ${testName} = ${match[1]}`);
        
        // Try multiple ways to find reference range
        let refRange = null;
        
        // Method 1: Look for pattern directly after the test name
        const refRangeMatch = normalizedText.match(new RegExp(`${testName}.*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`));
        if (refRangeMatch) {
          refRange = refRangeMatch[1];
        }
        
        // Method 2: Look for reference range pattern in the same line as the value
        if (!refRange) {
          const contextMatch = match.input.match(/(\d+\.?\d*\s*[-–]\s*\d+\.?\d*)/g);
          if (contextMatch && contextMatch.length > 0) {
            // Get the first range that appears after the value
            const valuePos = match.input.indexOf(match[1]);
            for (const range of contextMatch) {
              if (match.input.indexOf(range) > valuePos) {
                refRange = range;
                break;
              }
            }
          }
        }
        
        results[testName] = {
          value: parseFloat(match[1]),
          unit: pattern.standardUnit,
          rawText: match[0].trim(),
          referenceRange: refRange,
          confidence: 0.8
        };
      }
    } catch (error) {
      console.error(`Error parsing ${testName}:`, error);
    }
  }
  
  return results;
}

// Helper function to parse "Result X.XX (unit)" format
function parseResultFormat(text) {
  const results = {};
  
  if (!text) return results;
  
  // Split text into lines for easier processing
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  for (let i = 0; i < lines.length - 1; i++) {
    const currentLine = lines[i];
    const nextLine = lines[i + 1];
    
    // Check if next line contains "Result" followed by a number and unit
    const resultMatch = nextLine.match(/^Result\s+([\d.]+)\s*\(([^)]+)\)/i);
    
    if (resultMatch) {
      const value = parseFloat(resultMatch[1]);
      const unit = resultMatch[2];
      
      // Try to match the current line (biomarker name) with known patterns
      const biomarkerName = findBiomarkerMatch(currentLine);
      
      if (biomarkerName) {
        console.log(`Found Result format: ${biomarkerName} = ${value} ${unit}`);
        
        // ENHANCED: Look for reference range in nearby lines and convert to proper format
        let referenceRange = null;
        
        // Check next few lines for reference range
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const refLine = lines[j];
          
          // Common reference range patterns
          const refPatterns = [
            // Standard range format: "X.X - Y.Y"
            /([\d.]+)\s*[-–]\s*([\d.]+)/i,
            // Less than format: "< X.X"
            /Normal result range\s*<\s*([\d.]+)/i,
            /Reference range\s*<\s*([\d.]+)/i,
            /<\s*([\d.]+)/i,
            // Greater than format: "> X.X"
            /Normal result range\s*>\s*([\d.]+)/i,
            /Reference range\s*>\s*([\d.]+)/i,
            />\s*([\d.]+)/i,
            // Standard format with labels
            /Reference range\s*:\s*([\d.]+)\s*[-–]\s*([\d.]+)/i,
            /Normal\s*:\s*([\d.]+)\s*[-–]\s*([\d.]+)/i
          ];
          
          for (const pattern of refPatterns) {
            const refMatch = refLine.match(pattern);
            if (refMatch) {
              // Convert different formats to standard "min-max" format
              if (refLine.includes('<')) {
                // For "< X.X", create range from 0 to X.X
                const maxValue = parseFloat(refMatch[1]);
                referenceRange = `0.0-${maxValue}`;
              } else if (refLine.includes('>')) {
                // For "> X.X", create range from X.X to a reasonable upper bound
                const minValue = parseFloat(refMatch[1]);
                const upperBound = minValue * 3; // Reasonable upper bound
                referenceRange = `${minValue}-${upperBound}`;
              } else if (refMatch[2]) {
                // Standard "X.X-Y.Y" format
                referenceRange = `${refMatch[1]}-${refMatch[2]}`;
              }
              break;
            }
          }
          
          if (referenceRange) break;
        }
        
        // If we couldn't find a reference range, try to get it from biomarkerData
        if (!referenceRange && biomarkerData && biomarkerData[biomarkerName]) {
          const biomarkerInfo = biomarkerData[biomarkerName];
          if (biomarkerInfo.referenceRange) {
            referenceRange = biomarkerInfo.referenceRange;
          }
        }
        
        results[biomarkerName] = {
          value: value,
          unit: unit,
          rawText: `${currentLine} ${nextLine}`,
          referenceRange: referenceRange,
          confidence: 0.95
        };
        
        console.log(`Parsed reference range: ${referenceRange} for ${biomarkerName}`);
      } else {
        // If we can't match to a known biomarker, store with the raw name
        console.log(`Found Result format for unknown biomarker: ${currentLine} = ${value} ${unit}`);
        results[currentLine] = {
          value: value,
          unit: unit,
          rawText: `${currentLine} ${nextLine}`,
          referenceRange: null,
          confidence: 0.7
        };
      }
    }
  }
  
  return results;
}

// NEW: Helper function to match biomarker names to known patterns
function findBiomarkerMatch(testName) {
  // Direct match first
  if (labPatterns[testName]) {
    return testName;
  }
  
  // Check alternate names
  for (const [patternName, pattern] of Object.entries(labPatterns)) {
    if (pattern.alternateNames && pattern.alternateNames.includes(testName)) {
      return patternName;
    }
    
    // Check if any alternate name matches (case insensitive)
    if (pattern.alternateNames) {
      for (const altName of pattern.alternateNames) {
        if (altName.toLowerCase() === testName.toLowerCase()) {
          return patternName;
        }
      }
    }
  }
  
  // Check for partial matches (for cases like "APOLIPOPROTEIN B" -> "Apo-B")
  const testNameLower = testName.toLowerCase();
  for (const [patternName, pattern] of Object.entries(labPatterns)) {
    if (pattern.alternateNames) {
      for (const altName of pattern.alternateNames) {
        if (testNameLower.includes(altName.toLowerCase()) || altName.toLowerCase().includes(testNameLower)) {
          return patternName;
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract test date from OCR text
 * @param {string} text - OCR text
 * @returns {Date|null} Extracted test date
 */
// And modify your extractTestDate function to also try the structured date extraction
function extractTestDate(text, filePath) {
  if (!text || typeof text !== 'string') {
    console.log('Invalid text provided to extractTestDate');
    return new Date(); // Return current date for invalid input
  }

  try {
    // First try the structured lab report date extraction
    const structuredDate = extractStructuredDate(text);
    if (structuredDate) {
      console.log("Found date using structured format parser");
      return structuredDate;
    }
  
    // Add direct search for Collection Date in the OCR text
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

    // Continue with your existing code...
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
      if (fileNameMatch) {
        const [_, month, day, year] = fileNameMatch;
        console.log(`Extracted date from filename: ${month}/${day}/${year}`);
        return new Date(year, parseInt(month) - 1, day);
      }
    }
    
    // If no date found, return current date
    console.log('No valid date found, using current date');
    return new Date();
  } catch (error) {
    console.log(`Error in extractTestDate: ${error}`);
    return new Date();
  }
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
      testDate: new Date()
    };
  }
}

module.exports = {
  extractFromPDF: extractFromPDFWrapper,
  parseLabValues,
  extractTestDate
};