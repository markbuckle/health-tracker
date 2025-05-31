/**
 * OCR Parser Factory
 * 
 * This module provides a way to select between different OCR implementations
 * based on configuration or environment variables.
 */
require('dotenv').config();

// Get the selected OCR implementation from environment variables
const selectedImplementation = process.env.OCR_IMPLEMENTATION || 'PyTesseract';

// Import implementations directly (not dynamically) for Vercel compatibility
let parserModule;

try {
    console.log(`Attempting to load ${selectedImplementation} OCR implementation`);
    
    if (selectedImplementation === 'PaddleOCR') {
        // Direct import for PaddleOCR
        parserModule = require('./PaddleOCR/labParser');
        console.log('Successfully loaded PaddleOCR implementation');
    } else if (selectedImplementation === 'PyTesseract') {
        // Direct import for PyTesseract
        parserModule = require('./PyTesseract/labParser');
        console.log('Successfully loaded PyTesseract implementation');
    } else {
        throw new Error(`Unknown OCR implementation: ${selectedImplementation}`);
    }
} catch (error) {
    console.error(`Failed to load ${selectedImplementation} implementation:`, error.message);
    
    // Try to fall back to a working implementation
    try {
        if (selectedImplementation !== 'PaddleOCR') {
            console.log('Attempting fallback to PaddleOCR...');
            parserModule = require('./PaddleOCR/labParser');
            console.log('Successfully loaded PaddleOCR as fallback');
        } else {
            console.log('Attempting fallback to PyTesseract...');
            parserModule = require('./PyTesseract/labParser');
            console.log('Successfully loaded PyTesseract as fallback');
        }
    } catch (fallbackError) {
        console.error('All OCR implementations failed to load:', fallbackError.message);
        // Provide a dummy implementation that doesn't crash
        parserModule = {
            extractFromPDF: async (filePath) => {
                console.warn('OCR functionality disabled - no working implementation found');
                return {
                    labValues: {},
                    testDate: new Date()
                };
            },
            parseLabValues: (text) => ({}),
            extractTestDate: (text) => new Date(),
            interpretConfidence: (confidence) => 'unknown'
        };
    }
}

/**
 * Extract lab values and test date from a PDF or image file
 * @param {string} filePath - Path to the file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted lab values and test date
 */
async function extractFromPDF(filePath) {
    try {
        return await parserModule.extractFromPDF(filePath);
    } catch (error) {
        console.error('Error in extractFromPDF:', error.message);
        return {
            labValues: {},
            testDate: new Date()
        };
    }
}

/**
 * Parse lab values from OCR text
 * @param {string} text - OCR text
 * @returns {Object} Extracted lab values
 */
function parseLabValues(text) {
    try {
        return parserModule.parseLabValues(text);
    } catch (error) {
        console.error('Error in parseLabValues:', error.message);
        return {};
    }
}

/**
 * Extract test date from OCR text
 * @param {string} text - OCR text
 * @returns {Date|null} Extracted test date
 */
function extractTestDate(text) {
    try {
        return parserModule.extractTestDate(text);
    } catch (error) {
        console.error('Error in extractTestDate:', error.message);
        return new Date();
    }
}

/**
 * Interpret OCR confidence level
 * @param {number} confidence - Confidence value
 * @returns {string} Confidence level (high, medium, low)
 */
function interpretConfidence(confidence) {
    try {
        return parserModule.interpretConfidence(confidence);
    } catch (error) {
        console.error('Error in interpretConfidence:', error.message);
        return 'unknown';
    }
}

// Export the parser functions
module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence,
    implementation: selectedImplementation
};