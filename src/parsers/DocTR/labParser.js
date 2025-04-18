// DocTR has better OCR quality compared to Tesseract

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { labPatterns, datePatterns, enhancedTestosteronePatterns, structuredTestPatterns } = require('../labPatterns');

/**
 * DocTR-based lab document parser
 * This module uses DocTR's deep learning models for better OCR performance
 * compared to traditional OCR solutions like Tesseract
 */

// Configuration
const DOCTR_API_URL = process.env.DOCTR_API_URL || 'http://localhost:8000/process_document';
const DEBUG = process.env.DEBUG_OCR === 'true';

/**
 * Parse lab values from OCR text
 * @param {string} text - The OCR processed text
 * @returns {Object} Extracted lab values
 */
function parseLabValues(text) {
    const results = {};
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n');

    // Debug logging
    if (DEBUG) console.log('Starting DocTR lab value parsing...');
    
    // First try structured format (TEST NAME RESULT format)
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
                    if (DEBUG) console.log(`Found structured format match: ${testName} = ${value} ${unit}`);
                    results[testName] = {
                        value: parseFloat(value).toFixed(2),
                        unit: unit,
                        rawText: nextLine.trim(),
                        referenceRange: refRange,
                        confidence: 0.95,
                        matchType: 'structured'
                    };
                }
            }
        }
    }

    // Try enhanced testosterone patterns
    for (const [testName, pattern] of Object.entries(enhancedTestosteronePatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                if (DEBUG) console.log(`Found testosterone match: ${testName} = ${match[1]}`);
                const refRangeMatch = normalizedText.match(new RegExp(`${testName}.*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`));
                
                results[testName] = {
                    value: Number(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: match[0].trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[1] : null,
                    confidence: 0.95,
                    matchType: 'enhanced'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Try structured test patterns
    for (const [testName, pattern] of Object.entries(structuredTestPatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                const refRangeMatch = pattern.referencePattern 
                    ? normalizedText.match(pattern.referencePattern) 
                    : null;
                
                results[testName] = {
                    value: Number(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: match[0].trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[1] : null,
                    confidence: 0.95,
                    matchType: 'structured_specialized'
                };
            }
        } catch (error) {
            console.error(`Error parsing structured test ${testName}:`, error);
        }
    }

    // Try standard patterns for remaining values
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        // Skip if already found by other methods
        if (results[testName]) continue;

        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                if (DEBUG) console.log(`Found standard match: ${testName} = ${match[1]}`);
                const matchLine = lines.find(line => line.includes(match[0])) || '';
                const refRangeMatch = matchLine.match(/\d+\.?\d*\s*[-–]\s*\d+\.?\d*/);

                results[testName] = {
                    value: parseFloat(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: matchLine.trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[0] : null,
                    confidence: 0.9,
                    matchType: 'standard'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Apply fuzzy matching for potential missed values
    applyFuzzyMatching(normalizedText, lines, results);

    // Log final results if in debug mode
    if (DEBUG) {
        console.log('DocTR parsed results:', {
            totalValues: Object.keys(results).length,
            foundTests: Object.keys(results),
            details: results
        });
    }

    return results;
}

/**
 * Apply fuzzy matching for lab names that might have slight variations
 * @param {string} normalizedText - The normalized OCR text
 * @param {string[]} lines - The OCR text split into lines 
 * @param {Object} results - The results object to populate
 */
function applyFuzzyMatching(normalizedText, lines, results) {
    const potentialLabNames = extractPotentialLabNames(lines);
    
    potentialLabNames.forEach(labText => {
        // Skip if too short (likely not a lab name)
        if (labText.length < 3) return;
        
        // Try to find a biomarker match
        const biomarkerMatch = findBiomarkerMatch(labText);
        if (biomarkerMatch && !results[biomarkerMatch]) {
            // Search for a value pattern near this text
            const valueMatch = findValueNearText(normalizedText, labText);
            if (valueMatch) {
                results[biomarkerMatch] = {
                    value: parseFloat(valueMatch.value).toFixed(2),
                    unit: valueMatch.unit || labPatterns[biomarkerMatch]?.standardUnit || '',
                    rawText: valueMatch.rawText,
                    referenceRange: valueMatch.range || null,
                    confidence: 0.75, // Lower confidence for fuzzy matches
                    matchType: 'fuzzy'
                };
            }
        }
    });
}

/**
 * Extract potential lab test names from OCR text
 * @param {string[]} lines - The OCR text split into lines
 * @returns {string[]} Potential lab test names
 */
function extractPotentialLabNames(lines) {
    const potentialNames = [];
    
    // Look for potential lab name patterns at the beginning of lines
    const labNamePattern = /^([A-Za-z\s\-]+)(?:\:|\s+\d|\s+[<>])/;
    
    lines.forEach(line => {
        const match = line.match(labNamePattern);
        if (match && match[1].length > 3) {
            potentialNames.push(match[1].trim());
        }
    });
    
    return potentialNames;
}

/**
 * Find a value pattern near some text in the document
 * @param {string} fullText - The full OCR text
 * @param {string} targetText - The text to search near
 * @returns {Object|null} The found value or null
 */
function findValueNearText(fullText, targetText) {
    // Position of the target text
    const position = fullText.indexOf(targetText);
    if (position === -1) return null;
    
    // Search window: text + next 200 characters
    const searchText = fullText.substring(position, position + targetText.length + 200);
    
    // Value pattern: number possibly followed by unit and reference range
    const valuePattern = /(\d+\.?\d*)\s*([a-zA-Z/]+)?(?:[\s\(]*(\d+\.?\d*\s*[-–]\s*\d+\.?\d*)?)?/;
    const match = searchText.match(valuePattern);
    
    if (match) {
        return {
            value: match[1],
            unit: match[2] || '',
            range: match[3] || '',
            rawText: match[0]
        };
    }
    
    return null;
}

/**
 * Find biomarker match using Levenshtein distance for fuzzy matching
 * @param {string} text - The text to match against biomarker names
 * @returns {string|null} The matched biomarker name or null
 */
function findBiomarkerMatch(text) {
    let bestMatch = null;
    let bestScore = Infinity;
    
    for (const [name, pattern] of Object.entries(labPatterns)) {
        const allNames = [name, ...(pattern.alternateNames || [])];
        
        for (const patternName of allNames) {
            const distance = levenshteinDistance(text.toLowerCase(), patternName.toLowerCase());
            const score = distance / Math.max(text.length, patternName.length);
            
            if (score < bestScore && score <= (1 - pattern.fuzzyThreshold)) {
                bestScore = score;
                bestMatch = name;
            }
        }
    }
    
    return bestMatch;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} The Levenshtein distance
 */
function levenshteinDistance(a, b) {
    const matrix = Array(b.length + 1).fill().map(() => Array(a.length + 1).fill(0));
    
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= b.length; j++) {
        for (let i = 1; i <= a.length; i++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[j][i] = Math.min(
                matrix[j - 1][i] + 1,
                matrix[j][i - 1] + 1,
                matrix[j - 1][i - 1] + cost
            );
        }
    }
    
    return matrix[b.length][a.length];
}

/**
 * Extract test date from OCR text
 * @param {string} text - The OCR text
 * @returns {Date|null} The extracted date or null
 */
function extractTestDate(text) {
    if (!text || typeof text !== 'string') {
        console.log('Invalid text provided to extractTestDate');
        return null;
    }

    // Sort patterns by priority
    const sortedPatterns = [...datePatterns].sort((a, b) => a.priority - b.priority);

    for (const pattern of sortedPatterns) {
        const match = pattern.regex.exec(text);
        if (match) {
            try {
                const dateStr = match[1].trim();
                const parts = dateStr.split(/[-\s]/);

                // Handle format "DD-MMM-YYYY"
                if (parts.length === 3) {
                    const monthMap = {
                        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                    };

                    // Check if first part is day or year
                    if (parts[0].length === 2) { // DD-MMM-YYYY
                        const day = parseInt(parts[0]);
                        const month = monthMap[parts[1]];
                        const year = parseInt(parts[2].split(' ')[0]); // Remove any time component
                        return new Date(year, month, day);
                    } else { // YYYY-MMM-DD
                        const year = parseInt(parts[0]);
                        const month = monthMap[parts[1]];
                        const day = parseInt(parts[2].split(' ')[0]); // Remove any time component
                        return new Date(year, month, day);
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
 * Main function to extract lab data from PDF
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Object>} Extracted lab data
 */
async function extractFromPDF(filePath) {
    try {
        // Read the file
        const fileBuffer = fs.readFileSync(filePath);
        const fileExtension = path.extname(filePath).toLowerCase();
        
        // Create form data for the API request
        const formData = new FormData();
        const blob = new Blob([fileBuffer], { type: fileExtension === '.pdf' ? 'application/pdf' : 'image/jpeg' });
        formData.append('file', blob, path.basename(filePath));
        
        if (DEBUG) console.log(`Sending ${fileExtension} file to DocTR API for processing...`);
        
        // Call the DocTR API
        const response = await axios.post(DOCTR_API_URL, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        
        const { text, confidence } = response.data;
        
        if (DEBUG) console.log(`DocTR OCR completed with confidence: ${confidence}`);
        
        // Parse lab values and test date
        const labValues = parseLabValues(text);
        const testDate = extractTestDate(text);
        
        return {
            labValues,
            testDate,
            confidence
        };
    } catch (error) {
        console.error('Error extracting from PDF with DocTR:', error);
        throw error;
    }
}

/**
 * Interpret OCR confidence level
 * @param {number} confidence - The OCR confidence value (0-1)
 * @returns {string} The confidence level description
 */
function interpretConfidence(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.75) return 'medium';
    return 'low';
}

module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence
};