const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const pdf = require('pdf-parse');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas, loadImage } = require('canvas');
const { labPatterns, datePatterns, enhancedTestosteronePatterns, structuredTestPatterns } = require('./labPatterns');

pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js');

function parseLabValues(text) {
    const results = {};
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n');

    // Debug logging
    console.log('Starting lab value parsing...');
    
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
                    console.log(`Found structured format match: ${testName} = ${value} ${unit}`);
                    results[testName] = {
                        value: parseFloat(value).toFixed(2),
                        unit: unit,
                        rawText: nextLine.trim(),
                        referenceRange: refRange,
                        confidence: 1,
                        matchType: 'structured'
                    };
                }
            }
        }
    }

    // Try specialized structured test patterns
    for (const [testName, pattern] of Object.entries(structuredTestPatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                console.log(`Found structured test match: ${testName} = ${match[1]}`);
                
                // Try to extract reference range if pattern has one
                let referenceRange = null;
                if (pattern.referencePattern) {
                    const refMatch = pattern.referencePattern.exec(normalizedText);
                    referenceRange = refMatch ? refMatch[1] : null;
                }
                
                results[testName] = {
                    value: parseFloat(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: match[0].trim(),
                    referenceRange: referenceRange,
                    confidence: 1,
                    matchType: 'structured-special'
                };
            }
        } catch (error) {
            console.error(`Error parsing structured pattern ${testName}:`, error);
        }
    }

    // Then try enhanced testosterone patterns
    for (const [testName, pattern] of Object.entries(enhancedTestosteronePatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                console.log(`Found testosterone match: ${testName} = ${match[1]}`);
                const refRangeMatch = normalizedText.match(new RegExp(`${testName}.*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`));
                
                results[testName] = {
                    value: Number(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: match[0].trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[1] : null,
                    confidence: 1,
                    matchType: 'enhanced'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Finally try standard patterns for remaining values
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        // Skip if already found by other methods
        if (results[testName]) continue;

        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                console.log(`Found standard match: ${testName} = ${match[1]}`);
                const matchLine = lines.find(line => line.includes(match[0])) || '';
                const refRangeMatch = matchLine.match(/\d+\.?\d*\s*[-–]\s*\d+\.?\d*/);

                results[testName] = {
                    value: parseFloat(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: matchLine.trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[0] : null,
                    confidence: 1,
                    matchType: 'standard'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    function validateResults(results, text) {
        const validatedResults = {...results};
        const lines = text.split('\n');

        // List of tests that might appear near reference keywords but are actual results
        const commonLabTests = ['FSH', 'LH', 'Prolactin', 'PSA', 'Vitamin D'];
        
        // Words that indicate we're in a reference range section rather than a result
        const referenceKeywords = ['range', 'phase', 'peak', 'normal', 'reference', 'specific'];
        
        // Check each result against context clues
        Object.keys(validatedResults).forEach(testName => {
            // Skip validation for common tests
        if (commonLabTests.some(test => testName.includes(test))) {
            return; // Keep these test results
        }
        
            const result = validatedResults[testName];
            const lineWithValue = lines.find(line => 
                line.includes(result.value) && 
                !referenceKeywords.some(keyword => 
                    line.toLowerCase().includes(keyword)
                )
            );
            
            // If the line with this value contains reference keywords, it's likely a false positive
            // if (!lineWithValue) {
            //     console.log(`Removing false positive for ${testName}: ${result.value} (found in reference section)`);
            //     delete validatedResults[testName];
            // }
        });
        
        return validatedResults;
    }

    // Log final results before validation
    console.log('Parsed results:', {
        totalValues: Object.keys(results).length,
        foundTests: Object.keys(results),
        details: results
    });
    
    // Then before returning results:
    const validatedResults = validateResults(results, text);
    console.log('After validation:', { 
        totalValues: Object.keys(validatedResults).length,
        foundTests: Object.keys(validatedResults)
    });

    return validatedResults;
}

async function preprocessImage(imageBuffer) {
    // Load image into canvas
    const image = await loadImage(imageBuffer);
    const canvas = createCanvas(image.width, image.height);
    const ctx = canvas.getContext('2d');
    
    // Draw original image
    ctx.drawImage(image, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Advanced preprocessing for better OCR
    // Step 1: Noise reduction
    // Simple blur to reduce noise
    const tempCanvas = createCanvas(canvas.width, canvas.height);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);
    ctx.filter = 'blur(0.5px)';
    ctx.drawImage(tempCanvas, 0, 0);
    ctx.filter = 'none';
    
    // Get updated image data after blur
    const updatedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const updatedData = updatedImageData.data;
    
    // Step 2: Enhanced contrast with adaptive thresholding
    for (let i = 0; i < updatedData.length; i += 4) {
        const brightness = 0.299 * updatedData[i] + 0.587 * updatedData[i + 1] + 0.114 * updatedData[i + 2];
        
        // Increase contrast
        const contrast = 1.5; // Higher contrast for document images
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        let newBrightness = factor * (brightness - 128) + 128;
        
        // Adaptive thresholding based on local region
        let threshold = 140; // Slightly higher baseline threshold for documents
        
        // Adjust threshold based on brightness region
        if (brightness > 200) threshold = 180;
        else if (brightness < 60) threshold = 100;
        
        // Apply thresholding with a slight bias toward keeping text
        const finalValue = newBrightness > threshold ? 255 : 0;
        
        updatedData[i] = finalValue;     // R
        updatedData[i + 1] = finalValue; // G 
        updatedData[i + 2] = finalValue; // B
    }
    
    // Put processed image back
    ctx.putImageData(updatedImageData, 0, 0);
    
    // Step 3: Scale up image with sharpening for better OCR
    const scaleFactor = 2.5; // Slightly larger scale
    const scaledCanvas = createCanvas(canvas.width * scaleFactor, canvas.height * scaleFactor);
    const scaledCtx = scaledCanvas.getContext('2d');
    
    // Use better scaling algorithm
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
    
    // Optional: Additional configuration options for Tesseract
    const config = {
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-+/()%: ',
    };
    
    return { 
        buffer: scaledCanvas.toBuffer('image/png'),
        config: config
    };
}

async function performOCR(imageResult) {
    const worker = await createWorker();
    try {
        await worker.setParameters(imageResult.config || {});
        const { data: { text, confidence } } = await worker.recognize(imageResult.buffer);
        console.log('Raw OCR output:', text);
        console.log(`Tesseract confidence: ${confidence}%`);

        // Parse lab values
        const labValues = parseLabValues(text);
        
        // Add confidence metadata
        Object.keys(labValues).forEach(key => {
            labValues[key].confidence = confidence / 100;
            labValues[key].confidenceLevel = interpretConfidence(confidence);
        });

        return { text, labValues };
    } finally {
        await worker.terminate();
    }
}

async function extractFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        let labValues = {};
        let testDate = null;
        
        try {
            const data = await pdf(dataBuffer);
            if (data.text.trim()) {
                console.log('PDF.js extracted text:', data.text);
                labValues = parseLabValues(data.text);
                testDate = extractTestDate(data.text);
            }
        } catch (error) {
            console.log('PDF.js extraction failed:', error);
        }

        if (Object.keys(labValues).length === 0) {
            console.log('No results from PDF.js, trying OCR...');
            const pdfDocument = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
            const numPages = pdfDocument.numPages;
            let allResults = {};
            
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                console.log(`Processing page ${pageNum} of ${numPages}`);
                const page = await pdfDocument.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = createCanvas(viewport.width, viewport.height);
                const context = canvas.getContext('2d');

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                const results = await performOCR(canvas.toBuffer('image/png'));
                
                // Try to get test date from first page if we don't have one yet
                if (!testDate) {
                    testDate = extractTestDate(results.text);
                }

                allResults = { ...allResults, ...results.labValues };
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

async function extractFromImage(filePath) {
    try {
        const imageBuffer = fs.readFileSync(filePath);
        // Preprocess image for better OCR
        const processedImage = await preprocessImage(imageBuffer);
        // Perform OCR on the preprocessed image
        const results = await performOCR(processedImage);
        
        return {
            labValues: results.labValues,
            testDate: extractTestDate(results.text)
        };
    } catch (error) {
        console.error('Error extracting from image:', error);
        throw error;
    }
}

async function extractFromFile(filePath) {
    try {
        const extension = path.extname(filePath).toLowerCase();
        
        if (['.jpg', '.jpeg', '.png'].includes(extension)) {
            // Handle image files directly
            const imageBuffer = fs.readFileSync(filePath);
            const processedImage = await preprocessImage(imageBuffer);
            const results = await performOCR(processedImage);
            return {
                labValues: results.labValues,
                testDate: extractTestDate(results.text)
            };
        } else {
            // Handle PDF files
            return await extractFromPDF(filePath);
        }
    } catch (error) {
        console.error(`Error processing file ${path.basename(filePath)}:`, error);
        throw error;
    }
}

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

function interpretConfidence(confidence) {
    if (confidence >= 90) return 'high';
    if (confidence >= 75) return 'medium';
    return 'low';
}

module.exports = {
    preprocessImage,
    extractFromPDF,
    extractFromFile, 
    extractFromImage,
    parseLabValues,
    extractTestDate
};