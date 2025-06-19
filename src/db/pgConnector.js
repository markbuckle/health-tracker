// src/parsers/index.js - Updated for production compatibility

require('dotenv').config();

// Detect environment
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const selectedImplementation = process.env.OCR_IMPLEMENTATION || 'PyTesseract';
const hasExternalOCRService = process.env.OCR_SERVICE_URL && !isProduction;

console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
console.log(`OCR Implementation: ${selectedImplementation}`);
console.log(`External OCR Service: ${hasExternalOCRService ? 'Enabled' : 'Disabled'}`);

let parserModule;

try {
    if (isProduction) {
        console.log('Production environment detected - disabling OCR processing');
        // In production, use a simplified parser that doesn't require external services
        parserModule = {
            extractFromPDF: async (filePath) => {
                console.log('Production: OCR processing disabled, saving file metadata only');
                return {
                    labValues: {},
                    testDate: new Date()
                };
            },
            parseLabValues: (text) => ({}),
            extractTestDate: (text) => new Date(),
            interpretConfidence: (confidence) => 'unknown'
        };
    } else if (hasExternalOCRService) {
        console.log('Development: Using external OCR service');
        // Use external OCR service in development
        try {
            parserModule = require('./ExternalOCR/labParser'); // If you have this
        } catch (err) {
            console.warn('External OCR service not available, falling back to local implementation');
            throw err;
        }
    } else {
        // Development environment - use local OCR
        console.log('Development: Using local OCR implementation');
        if (selectedImplementation === 'PaddleOCR') {
            parserModule = require('./PaddleOCR/labParser');
            console.log('Successfully loaded PaddleOCR implementation');
        } else {
            parserModule = require('./PyTesseract/labParser');
            console.log('Successfully loaded PyTesseract implementation');
        }
    }
} catch (error) {
    console.error(`Failed to load OCR implementation:`, error.message);
    
    // Fallback to a working implementation that doesn't crash
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

// src/parsers/index.js - Updated with unique variable names

require('dotenv').config();

// Detect environment - using unique variable names
const isProductionMode = process.env.NODE_ENV === 'production' || process.env.VERCEL;
const ocrImplementation = process.env.OCR_IMPLEMENTATION || 'PaddleOCR';
const externalOcrServiceEnabled = process.env.OCR_SERVICE_URL && !isProductionMode;

console.log(`Environment: ${isProductionMode ? 'Production' : 'Development'}`);
console.log(`OCR Implementation: ${ocrImplementation}`);
console.log(`External OCR Service: ${externalOcrServiceEnabled ? 'Enabled' : 'Disabled'}`);

let ocrParserModule;

try {
    if (isProductionMode) {
        console.log('Production environment detected - OCR processing disabled');
        // In production, clearly indicate OCR is disabled
        ocrParserModule = {
            extractFromPDF: async (filePath) => {
                console.log('Production: OCR processing disabled, saving file metadata only');
                return {
                    labValues: {},
                    testDate: new Date(),
                    processingErrors: ['OCR processing is disabled in production environment']
                };
            },
            parseLabValues: (text) => ({}),
            extractTestDate: (text) => new Date(),
            interpretConfidence: (confidence) => 'disabled'
        };
    } else if (externalOcrServiceEnabled) {
        console.log('Development: Attempting to use external OCR service');
        // Try to use external OCR service
        try {
            ocrParserModule = require('./ExternalOCR/labParser');
            console.log('Successfully loaded external OCR service');
        } catch (err) {
            console.error('External OCR service failed to load:', err.message);
            throw new Error(`External OCR service unavailable: ${err.message}`);
        }
    } else {
        // Development environment - use only the specified implementation
        console.log(`Development: Loading ${ocrImplementation} implementation`);
        
        if (ocrImplementation === 'PaddleOCR') {
            ocrParserModule = require('./PaddleOCR/labParser');
            console.log('Successfully loaded PaddleOCR implementation');
        } else {
            throw new Error(`Unsupported OCR implementation: ${ocrImplementation}. Only PaddleOCR is currently supported.`);
        }
    }
} catch (error) {
    console.error(`OCR implementation failed to load:`, error.message);
    
    // Don't fall back - provide clear error messaging
    ocrParserModule = {
        extractFromPDF: async (filePath) => {
            const errorMessage = `OCR failed to initialize: ${error.message}`;
            console.error(errorMessage);
            return {
                labValues: {},
                testDate: new Date(),
                processingErrors: [errorMessage]
            };
        },
        parseLabValues: (text) => {
            console.error('OCR not available for text parsing');
            return {};
        },
        extractTestDate: (text) => {
            console.error('OCR not available for date extraction');
            return new Date();
        },
        interpretConfidence: (confidence) => 'error'
    };
}

// Export functions with clear error states
async function extractFromPDF(filePath) {
    try {
        return await ocrParserModule.extractFromPDF(filePath);
    } catch (error) {
        console.error('Error in extractFromPDF:', error.message);
        return {
            labValues: {},
            testDate: new Date(),
            processingErrors: [`OCR extraction failed: ${error.message}`]
        };
    }
}

function parseLabValues(text) {
    try {
        return ocrParserModule.parseLabValues(text);
    } catch (error) {
        console.error('Error in parseLabValues:', error.message);
        return {};
    }
}

function extractTestDate(text) {
    try {
        return ocrParserModule.extractTestDate(text);
    } catch (error) {
        console.error('Error in extractTestDate:', error.message);
        return new Date();
    }
}

function interpretConfidence(confidence) {
    try {
        return ocrParserModule.interpretConfidence(confidence);
    } catch (error) {
        console.error('Error in interpretConfidence:', error.message);
        return 'error';
    }
}

module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence,
    implementation: isProductionMode ? 'production-fallback' : ocrImplementation
};