// src/parsers/index.js - Debug version with explicit logging

require('dotenv').config();

// Debug environment variables
console.log('=== OCR Parser Debug Info ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('VERCEL:', process.env.VERCEL);
console.log('OCR_IMPLEMENTATION:', process.env.OCR_IMPLEMENTATION);
console.log('GOOGLE_CLOUD_PROJECT_ID:', process.env.GOOGLE_CLOUD_PROJECT_ID);
console.log('================================');

(function() {
    const isProductionMode = process.env.NODE_ENV === 'production' || process.env.VERCEL;
    const ocrImplementation = process.env.OCR_IMPLEMENTATION || 'PaddleOCR';
    const hasGoogleConfig = !!(process.env.GOOGLE_CLOUD_PROJECT_ID && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY));

    console.log(`OCR Parser - Environment: ${isProductionMode ? 'Production' : 'Development'}`);
    console.log(`OCR Parser - Implementation: ${ocrImplementation}`);
    console.log(`OCR Parser - Has Google Config: ${hasGoogleConfig}`);

    let ocrParserModule;

    try {
        if (ocrImplementation === 'GoogleVision') {
            if (!hasGoogleConfig) {
                throw new Error('Google Cloud Vision configuration missing. Check GOOGLE_CLOUD_PROJECT_ID and credentials.');
            }
            
            console.log('OCR Parser: Loading Google Vision implementation');
            ocrParserModule = require('./GoogleVision/smartOcrRouter');
            console.log('OCR Parser: Google Vision loaded successfully');
            
        } else if (ocrImplementation === 'PaddleOCR') {
            if (isProductionMode) {
                console.log('OCR Parser: Production mode detected - PaddleOCR disabled');
                throw new Error('PaddleOCR is disabled in production. Use GoogleVision instead.');
            }
            
            console.log('OCR Parser: Loading PaddleOCR implementation');
            ocrParserModule = require('./PaddleOCR/labParser');
            console.log('OCR Parser: PaddleOCR loaded successfully');
            
        } else {
            throw new Error(`Unsupported OCR implementation: ${ocrImplementation}`);
        }
        
    } catch (error) {
        console.error(`OCR Parser: Failed to load ${ocrImplementation}:`, error.message);
        
        // Fallback module
        ocrParserModule = {
            extractFromPDF: async (filePath) => {
                console.log('OCR Parser: Using fallback - no OCR processing');
                return {
                    labValues: {},
                    testDate: new Date(),
                    rawText: '',
                    confidence: 0,
                    provider: 'fallback',
                    processingErrors: [`OCR failed to initialize: ${error.message}`]
                };
            },
            parseLabValues: (text) => ({}),
            extractTestDate: (text) => new Date(),
            interpretConfidence: (confidence) => 'error'
        };
    }

    // Export functions with consistent interface
    module.exports = {
        extractFromPDF: async function(filePath) {
            console.log(`OCR Parser: extractFromPDF called with: ${filePath}`);
            console.log(`OCR Parser: Using implementation: ${ocrImplementation}`);
            
            try {
                const result = await ocrParserModule.extractFromPDF(filePath);
                
                console.log('OCR Parser: extractFromPDF result:', {
                    labValueCount: Object.keys(result.labValues || {}).length,
                    textLength: result.rawText ? result.rawText.length : 0,
                    confidence: result.confidence,
                    provider: result.provider,
                    hasErrors: !!(result.processingErrors && result.processingErrors.length > 0)
                });
                
                return result;
                
            } catch (error) {
                console.error('OCR Parser: extractFromPDF error:', error.message);
                return {
                    labValues: {},
                    testDate: new Date(),
                    rawText: '',
                    confidence: 0,
                    provider: ocrImplementation.toLowerCase(),
                    processingErrors: [error.message]
                };
            }
        },
        
        parseLabValues: function(text) {
            return ocrParserModule.parseLabValues(text);
        },
        
        extractTestDate: function(text) {
            return ocrParserModule.extractTestDate(text);
        },
        
        interpretConfidence: function(confidence) {
            return ocrParserModule.interpretConfidence(confidence);
        },
        
        // Utility functions
        getCurrentImplementation: () => ocrImplementation,
        isProductionMode: () => isProductionMode,
        hasValidConfig: () => {
            if (ocrImplementation === 'GoogleVision') {
                return hasGoogleConfig;
            } else if (ocrImplementation === 'PaddleOCR') {
                return !isProductionMode; // PaddleOCR only works locally
            }
            return false;
        }
    };
})();