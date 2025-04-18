/**
 * OCR Parser Factory
 * 
 * This module provides a way to select between different OCR implementations
 * based on configuration or environment variables.
 */

const path = require('path');
require('dotenv').config();

// Get the selected OCR implementation from environment variables
const selectedImplementation = process.env.OCR_IMPLEMENTATION || 'PyTesseract';

// Import the selected implementation
let parserModule;
try {
    parserModule = require(path.join(__dirname, selectedImplementation, 'labParser'));
    console.log(`Using ${selectedImplementation} OCR implementation`);
} catch (error) {
    console.error(`Failed to load ${selectedImplementation} implementation: ${error.message}`);
    console.log('Falling back to PyTesseract implementation');
    // Fall back to PyTesseract if the selected implementation fails to load
    parserModule = require(path.join(__dirname, 'PyTesseract', 'labParser'));
}

/**
 * Extract lab values and test date from a PDF or image file
 * @param {string} filePath - Path to the file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted lab values and test date
 */
async function extractFromPDF(filePath) {
    return parserModule.extractFromPDF(filePath);
}

/**
 * Parse lab values from OCR text
 * @param {string} text - OCR text
 * @returns {Object} Extracted lab values
 */
function parseLabValues(text) {
    return parserModule.parseLabValues(text);
}

/**
 * Extract test date from OCR text
 * @param {string} text - OCR text
 * @returns {Date|null} Extracted test date
 */
function extractTestDate(text) {
    return parserModule.extractTestDate(text);
}

/**
 * Interpret OCR confidence level
 * @param {number} confidence - Confidence value
 * @returns {string} Confidence level (high, medium, low)
 */
function interpretConfidence(confidence) {
    return parserModule.interpretConfidence(confidence);
}

// Export the parser functions
module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence,
    implementation: selectedImplementation
};