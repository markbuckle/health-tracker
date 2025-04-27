// src/parsers/PyTesseract/labParser.js - Minimal working version

const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const pdf = require('pdf-parse');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas } = require('canvas');
const { labPatterns, datePatterns } = require('../labPatterns');

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js');

/**
 * Validates if a value is reasonable for a given biomarker
 * @param {string} testName - The biomarker name
 * @param {number} value - The extracted value
 * @returns {boolean} Whether the value is reasonable
 */
function isReasonableValue(testName, value) {
    // If value is not a number, it's not reasonable
    if (isNaN(parseFloat(value))) return false;
    
    // Convert to number for comparison
    const numValue = parseFloat(value);
    
    // Filter out extremely large values that are likely accession numbers or IDs
    if (numValue > 10000) return false;
    
    // If we have a specific range for this biomarker, check it
    // if (ranges[testName]) {
    //     const [min, max] = ranges[testName];
    //     return numValue >= min && numValue <= max;
    // }

    // const ranges = {
    //     // Electrolytes (mmol/L)
    //     'Sodium': [120, 160],
    //     'Potassium': [2.5, 6.5],
    //     'Chloride': [90, 115],
    //     'Calcium': [1.5, 3.5],
    // };

    // If we have a specific range for this biomarker, check it
    // if (ranges[testName]) {
    //     const [min, max] = ranges[testName];
    //     return numValue >= min && numValue <= max;
    // }

    // General reasonableness check for other markers
    return numValue >= 0 && numValue < 5000;
}

/**
 * Main entry point - extracts from both PDFs and images
 * @param {string} filePath - Path to the file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted lab values and test date
 */
async function extractFromPDF(filePath) {
    try {
        const extension = path.extname(filePath).toLowerCase();
        
        // Choose extraction method based on file type
        if (['.jpg', '.jpeg', '.png'].includes(extension)) {
            console.log(`Processing image file: ${filePath}`);
            return await extractFromImage(filePath);
        } else {
            console.log(`Processing PDF file: ${filePath}`);
            return await extractFromPdfDocument(filePath);
        }
    } catch (error) {
        console.error(`Error processing file ${path.basename(filePath)}:`, error);
        // Return current date instead of null to prevent MongoDB validation errors
        return { 
            labValues: {}, 
            testDate: new Date() 
        };
    }
}

/**
 * Process image files (JPG, PNG)
 * @param {string} filePath - Path to the image file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted data
 */
async function extractFromImage(filePath) {
    try {
        // Check if sharp is available for better image preprocessing
        let imageBuffer = fs.readFileSync(filePath);
        let enhancedBuffer = null;
        
        try {
            // Try to load sharp module dynamically (if available)
            const sharp = require('sharp');
            
            // Enhanced image preprocessing with sharp
            enhancedBuffer = await sharp(imageBuffer)
                .greyscale() // Convert to grayscale
                .normalize() // Normalize the image (improve contrast)
                .sharpen() // Sharpen to enhance text
                .threshold(150) // Apply threshold for better text recognition
                .toBuffer();
                
            console.log('Enhanced image with sharp for better OCR');
        } catch (err) {
            console.log('Sharp not available, using basic preprocessing');
            // Will use basic preprocessing in performOCR instead
        }
        
        // First try OCR with enhanced buffer if available
        let results = null;
        if (enhancedBuffer) {
            results = await performOCR(enhancedBuffer);
            
            // If confidence is too low, retry with original
            if (results.confidence < 50) {
                console.log(`Low confidence (${results.confidence}%) with enhanced image, trying original`);
                const originalResults = await performOCR(imageBuffer);
                
                // Use the better result
                if (originalResults.confidence > results.confidence) {
                    console.log(`Original image gave better results (${originalResults.confidence}% vs ${results.confidence}%)`);
                    results = originalResults;
                }
            }
        } else {
            // Standard OCR with original image
            results = await performOCR(imageBuffer);
        }
        
        // Extract date from text or filename
        let testDate = extractTestDate(results.text);
        
        // Try to extract date from filename if not found in content
        if (!testDate) {
            const fileNameMatch = path.basename(filePath).match(/(\d{4}[-_.]\d{2}[-_.]\d{2})|(\d{2}[-_.]\d{2}[-_.]\d{4})/);
            if (fileNameMatch) {
                const datePart = fileNameMatch[0].replace(/[_\.]/g, '-');
                try {
                    testDate = new Date(datePart);
                    console.log(`Extracted date from filename: ${testDate}`);
                } catch (err) {
                    console.log('Failed to parse date from filename:', err);
                }
            }
        }
        
        // Fallback to file stats date if needed
        if (!testDate || isNaN(testDate.getTime())) {
            try {
                const stats = fs.statSync(filePath);
                testDate = stats.mtime;
                console.log(`Using file modified date: ${testDate}`);
            } catch (err) {
                console.log('Could not get file stats, using current date');
                testDate = new Date();
            }
        }
        
        return {
            labValues: results.labValues,
            testDate: testDate
        };
    } catch (error) {
        console.error('Error extracting from image:', error);
        throw error;
    }
}

/**
 * Process PDF documents
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted data
 */
async function extractFromPdfDocument(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let labValues = {};
        let testDate = null;
        
        // First try to extract text directly from PDF
        try {
            const data = await pdf(dataBuffer);
            if (data.text.trim()) {
                console.log('PDF text extracted successfully with pdf-parse');
                labValues = parseLabValues(data.text);
                testDate = extractTestDate(data.text);
            }
        } catch (error) {
            console.log('PDF-parse extraction failed:', error);
        }

        // If direct extraction didn't yield results, try OCR
        if (Object.keys(labValues).length === 0) {
            console.log('No results from direct PDF parsing, trying OCR...');
            const pdfDocument = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
            const numPages = pdfDocument.numPages;
            let allResults = {};
            
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                console.log(`Processing page ${pageNum} of ${numPages}`);
                const page = await pdfDocument.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                // Render PDF page to canvas
                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Extract text with OCR
                const pageBuffer = canvas.toBuffer('image/png');
                const pageResults = await performOCR(pageBuffer);
                
                // Try to extract date if we don't have one yet
                if (!testDate && pageResults.text) {
                    testDate = extractTestDate(pageResults.text);
                }

                // Merge results from this page
                allResults = { ...allResults, ...pageResults.labValues };
            }
            
            labValues = allResults;
        }

        return {
            labValues,
            testDate
        };
    } catch (error) {
        console.error('Error extracting from PDF:', error);
        throw error;
    }
}

/**
 * Perform OCR on an image buffer
 * @param {Buffer} imageBuffer - Image data
 * @returns {Promise<{text: string, labValues: Object, confidence: number}>} OCR results
 */
async function performOCR(imageBuffer) {
    // Create worker with minimal configuration to avoid DataCloneError
    const worker = await createWorker();
    
    try {
        if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
            console.error('Invalid image buffer provided to OCR');
            return { text: '', labValues: {}, confidence: 0 };
        }

        // Try to preprocess image (using simple method)
        try {
            imageBuffer = await simplePreprocessImage(imageBuffer);
        } catch (error) {
            console.error('Image preprocessing failed, using original image:', error);
        }

        // Recognize text using default settings
        const { data } = await worker.recognize(imageBuffer);
        const text = data?.text || '';
        const confidence = data?.confidence || 0;
        
        console.log(`Tesseract confidence: ${confidence}%`);

        // Parse lab values
        const labValues = parseLabValues(text);
        
        // Add confidence metadata
        Object.keys(labValues).forEach(key => {
            labValues[key].confidence = confidence / 100;
            labValues[key].confidenceLevel = interpretConfidence(confidence);
        });

        return { text, labValues, confidence };
    } catch (error) {
        console.error('OCR error:', error);
        return { text: '', labValues: {}, confidence: 0 };
    } finally {
        await worker.terminate();
    }
}

/**
 * Preprocess image to improve OCR quality
 * @param {Buffer} imageBuffer - Original image buffer
 * @returns {Promise<Buffer>} Processed image buffer
 */
async function simplePreprocessImage(imageBuffer) {
    const { createCanvas, loadImage } = require('canvas');
    
    // Load image into canvas
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw the image
    ctx.drawImage(image, 0, 0);
    
    return canvas.toBuffer('image/png');
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
    
    // Check if the text contains a structured table format
    const hasTableFormat = normalizedText.includes('Results') && 
                            normalizedText.includes('Ref Range') || 
                            normalizedText.includes('REFERENCE') && 
                            normalizedText.includes('RESULT');
    
    // First look for structured table patterns
    if (hasTableFormat) {
        // Find lines with test names and their results
        const tableLines = lines.filter(line => 
            line.includes('Ref Range') || 
            line.includes('REFERENCE') ||
            (line.match(/\d+\.?\d*/) && line.match(/[-–]/)));
            
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // Look for lines that contain both test name and value
            for (const [testName, pattern] of Object.entries(labPatterns)) {
                if ((line.includes(testName) || 
                     pattern.alternateNames?.some(alt => line.includes(alt)))) {
                    
                    // Look for the value on the same line or the next line
                    const valueMatch = line.match(/(\d+\.?\d*)/);
                    let value = valueMatch ? valueMatch[1] : null;
                    
                    // If not found, check the next line
                    if (!value && i < lines.length - 1) {
                        const nextLine = lines[i + 1];
                        const nextValueMatch = nextLine.match(/(\d+\.?\d*)/);
                        value = nextValueMatch ? nextValueMatch[1] : null;
                    }
                    
                    // Look for reference range nearby
                    let refRange = null;
                    // Check current line for reference range
                    const rangeMatch = line.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                    if (rangeMatch) {
                        refRange = rangeMatch[0];
                    }
                    // Also look in nearby lines (3 before and 3 after)
                    if (!refRange) {
                        for (let j = Math.max(0, i-3); j <= Math.min(lines.length-1, i+3); j++) {
                            if (j === i) continue; // Skip current line (already checked)
                            const nearbyLine = lines[j];
                            if (nearbyLine.includes('Range') || nearbyLine.includes('REFERENCE')) {
                                const nearRangeMatch = nearbyLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                                if (nearRangeMatch) {
                                    refRange = nearRangeMatch[0];
                                    break;
                                }
                            }
                        }
                    }
                    
                    if (value) {
                        // If this test already exists with a higher value, don't override
                        // This is to prevent duplicate entries with different values
                        if (results[testName] && parseFloat(results[testName].value) > parseFloat(value)) {
                            console.log(`Not overriding ${testName} value ${results[testName].value} with ${value}`);
                            continue;
                        }
                        
                        if (isReasonableValue(testName, value)) {
                            results[testName] = {
                                value: parseFloat(value),
                                unit: pattern.standardUnit,
                                rawText: line.trim(),
                                referenceRange: refRange,
                                confidence: 0.8,
                                matchType: 'standard'
                            };
                        } else {
                            console.log(`Skipping unreasonable value for ${testName}: ${value}`);
                        }
                        // results[testName] = {
                        //     value: parseFloat(value),
                        //     unit: pattern.standardUnit,
                        //     rawText: line.trim(),
                        //     referenceRange: refRange,
                        //     confidence: 0.9,
                        //     matchType: 'structured'
                        // };
                        // console.log(`Found table match: ${testName} = ${value}, range: ${refRange}`);
                    }
                }
            }
        }
    }
    
    // Now try with standard regex patterns for any remaining values
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        // Skip if already found
        if (results[testName]) continue;
        
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                console.log(`Found match: ${testName} = ${match[1]}`);
                
                // Try to find reference range in the same line or nearby
                let refRange = null;
                const matchLineIndex = lines.findIndex(line => line.includes(match[0]));
                const matchLine = matchLineIndex >= 0 ? lines[matchLineIndex] : '';
                
                // Check for reference range in match line
                const refRangeMatch = matchLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                if (refRangeMatch) {
                    refRange = refRangeMatch[0];
                } else if (matchLineIndex >= 0) {
                    // Look in nearby lines for range patterns
                    for (let i = Math.max(0, matchLineIndex - 3); i <= Math.min(lines.length - 1, matchLineIndex + 3); i++) {
                        if (i === matchLineIndex) continue;
                        const nearbyLine = lines[i];
                        // Look for Range: or Reference Range: patterns
                        if (nearbyLine.includes('Range') || nearbyLine.includes('Reference')) {
                            const nearbyRangeMatch = nearbyLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                            if (nearbyRangeMatch) {
                                refRange = nearbyRangeMatch[0];
                                break;
                            }
                        }
                    }
                }
                
                // Don't override higher value entries
                if (results[testName] && parseFloat(results[testName].value) > parseFloat(match[1])) {
                    console.log(`Not overriding ${testName} value ${results[testName].value} with ${match[1]}`);
                    continue;
                }

                results[testName] = {
                    value: parseFloat(match[1]),
                    unit: pattern.standardUnit,
                    rawText: matchLine.trim(),
                    referenceRange: refRange,
                    confidence: 0.8,
                    matchType: 'standard'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Post-processing to detect and fix common issues
    // 1. Fix unreasonable values (e.g., extremely high testosterone)
    for (const [testName, value] of Object.entries(results)) {
        if (testName === 'Testosterone' && value.value > 100 && value.unit === 'nmol/L') {
            // This might be a misinterpreted ng/dL value, fix it
            console.log(`Correcting suspicious testosterone value: ${value.value}`);
            results[testName].value = value.value / 100;
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

    // Additional date patterns to try
    const extraDatePatterns = [
        // ISO format: YYYY-MM-DD
        /(?:date|collected|generated|received|reported)(?:\s*(?:on|of))?:?\s*(\d{4}-\d{2}-\d{2})/i,
        
        // US format: MM/DD/YYYY
        /(?:date|collected|generated|received|reported)(?:\s*(?:on|of))?:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
        
        // UK/European format: DD/MM/YYYY
        /(?:date|collected|generated|received|reported)(?:\s*(?:on|of))?:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
        
        // Text month format: DD-MMM-YYYY or YYYY-MMM-DD
        /(?:date|collected|generated|received|reported)(?:\s*(?:on|of))?:?\s*(\d{1,2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{1,2})/i
    ];

    // Try each date pattern in order of priority
    const sortedPatterns = [...datePatterns].sort((a, b) => a.priority - b.priority);
    
    for (const pattern of sortedPatterns) {
        const match = pattern.regex.exec(text);
        if (match) {
            try {
                const dateStr = match[1].trim();
                
                // Handle common date formats
                if (dateStr.includes('-')) {
                    // YYYY-MM-DD or DD-MM-YYYY
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                        if (parts[0].length === 4) {
                            const date = new Date(parts[0], parts[1] - 1, parts[2]);
                            if (!isNaN(date.getTime())) return date;
                        } else {
                            const date = new Date(parts[2], parts[1] - 1, parts[0]);
                            if (!isNaN(date.getTime())) return date;
                        }
                    }
                } else if (dateStr.includes('/')) {
                    // MM/DD/YYYY or DD/MM/YYYY
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        // Try both interpretations
                        // First as MM/DD/YYYY
                        let date = new Date(parts[2], parts[0] - 1, parts[1]);
                        if (!isNaN(date.getTime())) return date;
                        
                        // Then as DD/MM/YYYY
                        date = new Date(parts[2], parts[1] - 1, parts[0]);
                        if (!isNaN(date.getTime())) return date;
                    }
                }
            } catch (error) {
                console.log(`Error parsing date: ${error}`);
            }
        }
    }
    
    // If standard patterns fail, try extra patterns
    for (const regex of extraDatePatterns) {
        const match = regex.exec(text);
        if (match) {
            try {
                const dateStr = match[1].trim();
                
                // Parse based on date format
                if (dateStr.includes('-')) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        // YYYY-MM-DD
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) return date;
                    } else if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
                        // DD-MMM-YYYY
                        const [day, month, year] = dateStr.split('-');
                        const monthMap = {
                            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                        };
                        const date = new Date(parseInt(year), monthMap[month], parseInt(day));
                        if (!isNaN(date.getTime())) return date;
                    }
                } else if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        // Try both MM/DD/YYYY and DD/MM/YYYY
                        let date = new Date(parts[2], parts[0] - 1, parts[1]); // MM/DD/YYYY
                        if (!isNaN(date.getTime())) return date;
                        
                        date = new Date(parts[2], parts[1] - 1, parts[0]); // DD/MM/YYYY
                        if (!isNaN(date.getTime())) return date;
                    }
                }
            } catch (error) {
                console.log(`Error parsing date with extra pattern: ${error}`);
            }
        }
    }
    
    // As last resort, try looking for just plain date formats in the text
    const plainDateRegex = /\b(\d{1,2}[-\/]\d{1,2}[-\/]\d{4}|\d{4}[-\/]\d{1,2}[-\/]\d{1,2})\b/g;
    const plainDateMatches = text.match(plainDateRegex);
    
    if (plainDateMatches) {
        for (const dateStr of plainDateMatches) {
            try {
                // Try various date formats
                const date = new Date(dateStr);
                if (!isNaN(date.getTime())) return date;
                
                // If direct parsing fails, try other formats
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        // Try MM/DD/YYYY
                        let date = new Date(parts[2], parts[0] - 1, parts[1]);
                        if (!isNaN(date.getTime())) return date;
                        
                        // Try DD/MM/YYYY
                        date = new Date(parts[2], parts[1] - 1, parts[0]);
                        if (!isNaN(date.getTime())) return date;
                    }
                } else if (dateStr.includes('-')) {
                    const parts = dateStr.split('-');
                    if (parts.length === 3) {
                        if (parts[0].length === 4) {
                            // YYYY-MM-DD
                            let date = new Date(parts[0], parts[1] - 1, parts[2]);
                            if (!isNaN(date.getTime())) return date;
                        } else {
                            // DD-MM-YYYY
                            let date = new Date(parts[2], parts[1] - 1, parts[0]);
                            if (!isNaN(date.getTime())) return date;
                        }
                    }
                }
            } catch (error) {
                console.log(`Error parsing plain date: ${error}`);
            }
        }
    }
    
    // If all else fails, return current date to avoid validation errors
    console.log('No valid date found in text, using current date');
    return new Date();
}

/**
 * Interpret OCR confidence level
 * @param {number} confidence - Confidence value (0-100)
 * @returns {string} Confidence level description
 */
function interpretConfidence(confidence) {
    if (confidence >= 80) return 'high';
    if (confidence >= 60) return 'medium';
    return 'low';
}

module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence
};