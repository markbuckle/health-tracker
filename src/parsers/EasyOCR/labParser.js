// EasyOCR implementation for lab document processing

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { labPatterns, datePatterns } = require('../labPatterns');
const { biomarkerData } = require('../biomarkerData');

// Configuration
const EASYOCR_SCRIPT = path.join(__dirname, 'run_easyocr.py');

/**
 * Extract lab values and test date from a PDF or image file
 * @param {string} filePath - Path to the file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted lab values and test date
 */
async function extractFromPDF(filePath) {
    try {
        // Get file extension
        const fileExt = path.extname(filePath).toLowerCase();
        
        // Log the file type we're processing
        console.log(`Processing ${fileExt} file with EasyOCR...`);
        
        // Run Python script to extract text with EasyOCR
        const text = await runEasyOCR(filePath);
        
        // Parse the extracted text
        const labValues = parseLabValues(text);
        let testDate = extractTestDate(text);
        
        // Fix for Invalid Date issue - use file's modified date as fallback
        if (!testDate || isNaN(testDate.getTime())) {
            console.log("Could not extract valid date, using file stats as fallback");
            try {
                const stats = fs.statSync(filePath);
                testDate = stats.mtime;
            } catch (err) {
                console.log("File stats error, using current date:", err);
                testDate = new Date(); // Current date as a last resort
            }
        }
        
        // If PDF file has no lab values but has extractable text, try harder to find values
        if (fileExt === '.pdf' && Object.keys(labValues).length === 0 && text.length > 100) {
            console.log("No lab values found in initial parse, trying alternative parsing...");
            
            // Try different parsing techniques for PDFs with structured tables
            if (text.includes("TEST") && text.includes("RESULT") || 
                text.includes("Name") && text.includes("Value") || 
                text.includes("Parameter") && text.includes("Result")) {
                
                // Look for structured tables with test names and values
                const lines = text.split('\n');
                for (const line of lines) {
                    const parts = line.split(/\s+/);
                    if (parts.length >= 2) {
                        const possibleTestName = parts[0];
                        const possibleValue = parts.find(p => /^\d+\.?\d*$/.test(p));
                        
                        if (possibleTestName && possibleValue) {
                            console.log(`Found possible test: ${possibleTestName} = ${possibleValue}`);
                            // You could add this to labValues, though you may want to map it to standard names
                        }
                    }
                }
            }
        }
        
        return {
            labValues,
            testDate
        };
    } catch (error) {
        console.error(`Error extracting from file ${path.basename(filePath)}:`, error);
        // Always return a valid date to avoid MongoDB validation errors
        return {
            labValues: {},
            testDate: new Date()
        };
    }
}

/**
 * Run the EasyOCR Python script on a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<string>} Extracted text
 */
function runEasyOCR(filePath) {
    return new Promise((resolve, reject) => {
        const command = `python ${EASYOCR_SCRIPT} "${filePath}"`;
        
        exec(command, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                console.error(`EasyOCR error: ${error.message}`);
                console.error(`stderr: ${stderr}`);
                reject(error);
                return;
            }
            
            if (stderr) {
                console.warn(`EasyOCR warnings: ${stderr}`);
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
    
    if (!text) return results;
    
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n');
    
    // Try to match patterns from labPatterns.js
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                console.log(`Found match: ${testName} = ${match[1]}`);
                
                // Try to find reference range
                // Add this more aggressive reference range pattern
                let refRangeMatch = normalizedText.match(new RegExp(`${testName}[^0-9]*?(?:range|ref)[^0-9]*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`, 'i')) || 
                    normalizedText.match(new RegExp(`${testName}.*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`, 'i'));

                // Look in a window of lines around the matched line for reference range
                const matchLineIndex = lines.findIndex(line => line.includes(match[0]));
                if (matchLineIndex !== -1) {
                for (let i = Math.max(0, matchLineIndex - 2); i <= Math.min(lines.length - 1, matchLineIndex + 2); i++) {
                    const nearbyLine = lines[i];
                    if (nearbyLine.includes('Range') && nearbyLine.match(/\d+\.?\d*\s*[-–]\s*\d+\.?\d*/)) {
                    // const nearbyMatch = nearbyLine.match(/(\d+\.?\d*\s*[-–]\s*\d+\.?\d*)/);
                    // if (nearbyMatch) refRangeMatch = nearbyMatch;
                    const referenceRangePattern = new RegExp(`Ref(?:\\s*Range|erence\\s*Range)?[^0-9]*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`, 'i');
                    const fullDocRangeMatch = normalizedText.match(referenceRangePattern);
                    if (fullDocRangeMatch) {
                    refRangeMatch = fullDocRangeMatch;
                    }
                    // For known biomarkers, use the range from biomarkerData if available
                    if (labPatterns[testName]?.referenceRange) {
                        refRangeMatch = [null, labPatterns[testName].referenceRange];
                    }
                    break;
                    }
                }
                }
                
                const unit = match[2] || pattern.standardUnit || '';
                results[testName] = {
                    value: parseFloat(match[1]),
                    unit: unit,
                    rawText: match[0].trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[1] : 
                        (biomarkerData && biomarkerData[testName] ? biomarkerData[testName].referenceRange : null),
                    confidence: 0.8,
                    matchType: 'enhanced'
                };
                // results[testName] = {
                //     value: parseFloat(match[1]),
                //     unit: pattern.standardUnit,
                //     rawText: match[0].trim(),
                //     referenceRange: refRangeMatch ? refRangeMatch[1] : null,
                //     confidence: 0.8
                // };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }
    
    return results;
}

/**
 * Extract test date from OCR text
 * @param {string} text - OCR text
 * @returns {Date|null} Extracted test date
 */
function extractTestDate(text) {
    if (!text || typeof text !== 'string') {
        return null;
    }

    // Sort patterns by priority
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
                        // Assume MM/DD/YYYY format
                        return new Date(parts[2], parts[0] - 1, parts[1]);
                    }
                }
            } catch (error) {
                console.log(`Error parsing date: ${error}`);
            }
        }
    }
    
    return null;
}

/**
 * Interpret OCR confidence level
 * @param {number} confidence - Confidence value
 * @returns {string} Confidence level (high, medium, low)
 */
function interpretConfidence(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.7) return 'medium';
    return 'low';
}

module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence
};