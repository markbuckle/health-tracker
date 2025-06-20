// src/parsers/index.js - Debug version with explicit logging

require('dotenv').config();

// Debug environment variables
console.log('=== OCR Parser Debug Info ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL:', process.env.VERCEL);
console.log('OCR_IMPLEMENTATION:', process.env.OCR_IMPLEMENTATION);
console.log('OCR_SERVICE_URL:', process.env.OCR_SERVICE_URL);
console.log('================================');

(function() {
    // Use an IIFE to isolate variables
    const isProductionMode = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    const ocrImplementation = process.env.OCR_IMPLEMENTATION || 'PaddleOCR';
    const hasOcrServiceUrl = !!process.env.OCR_SERVICE_URL;
    const externalOcrServiceEnabled = hasOcrServiceUrl && !isProductionMode;

    console.log(`OCR Parser - Environment: ${isProductionMode ? 'Production' : 'Development'}`);
    console.log(`OCR Parser - Implementation: ${ocrImplementation}`);
    console.log(`OCR Parser - Has OCR_SERVICE_URL: ${hasOcrServiceUrl}`);
    console.log(`OCR Parser - External Service Enabled: ${externalOcrServiceEnabled}`);

    let ocrParserModule;

    try {
        if (isProductionMode) {
            console.log('OCR Parser: Production mode detected - OCR disabled');
            ocrParserModule = {
                extractFromPDF: async (filePath) => {
                    console.log('OCR Parser: Returning production fallback response');
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
            console.log('OCR Parser: Attempting to load external OCR service');
            // This should NOT execute since you don't have OCR_SERVICE_URL set
            throw new Error('External OCR service should not be enabled');
        } else {
            console.log(`OCR Parser: Loading local ${ocrImplementation} implementation`);
            if (ocrImplementation === 'PaddleOCR') {
                ocrParserModule = require('./PaddleOCR/labParser');
                console.log('OCR Parser: PaddleOCR loaded successfully');
            } else {
                throw new Error(`Unsupported OCR implementation: ${ocrImplementation}`);
            }
        }
    } catch (error) {
        console.error(`OCR Parser: Failed to load:`, error.message);
        ocrParserModule = {
            extractFromPDF: async (filePath) => {
                console.log('OCR Parser: Using error fallback');
                return {
                    labValues: {},
                    testDate: new Date(),
                    processingErrors: [`OCR failed to initialize: ${error.message}`]
                };
            },
            parseLabValues: (text) => ({}),
            extractTestDate: (text) => new Date(),
            interpretConfidence: (confidence) => 'error'
        };
    }

    // Export functions
    module.exports = {
        extractFromPDF: async function(filePath) {
            console.log('OCR Parser: extractFromPDF called with:', filePath);
            try {
                const result = await ocrParserModule.extractFromPDF(filePath);
                console.log('OCR Parser: extractFromPDF result:', {
                    labValueCount: Object.keys(result.labValues || {}).length,
                    hasErrors: !!(result.processingErrors && result.processingErrors.length > 0),
                    errors: result.processingErrors
                });
                return result;
            } catch (error) {
                console.error('OCR Parser: extractFromPDF error:', error.message);
                return {
                    labValues: {},
                    testDate: new Date(),
                    processingErrors: [`OCR extraction failed: ${error.message}`]
                };
            }
        },
        parseLabValues: function(text) {
            try {
                return ocrParserModule.parseLabValues(text);
            } catch (error) {
                console.error('OCR Parser: parseLabValues error:', error.message);
                return {};
            }
        },
        extractTestDate: function(text) {
            try {
                return ocrParserModule.extractTestDate(text);
            } catch (error) {
                console.error('OCR Parser: extractTestDate error:', error.message);
                return new Date();
            }
        },
        interpretConfidence: function(confidence) {
            try {
                return ocrParserModule.interpretConfidence(confidence);
            } catch (error) {
                console.error('OCR Parser: interpretConfidence error:', error.message);
                return 'error';
            }
        },
        implementation: isProductionMode ? 'production-fallback' : ocrImplementation
    };
})();