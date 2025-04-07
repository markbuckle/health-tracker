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

async function preprocessImageWithVariants(imageBuffer) {
    // Create an array to store multiple processing variants
    const variants = [];
    
    // Original image
    variants.push({
        buffer: imageBuffer,
        config: {
            tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-:/+<> ',
            tessedit_pageseg_mode: '6', // Assume a single uniform block of text
            preserve_interword_spaces: '1'
        },
        type: 'original'
    });
    
    // Variant 1: High contrast
    try {
        const image = await loadImage(imageBuffer);
        const canvas = createCanvas(image.width, image.height);
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // High contrast
        for (let i = 0; i < data.length; i += 4) {
            const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
            const contrast = 2.0; // Higher contrast
            const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
            const newBrightness = factor * (brightness - 128) + 128;
            
            const threshold = 128;
            const finalValue = newBrightness > threshold ? 255 : 0;
            
            data[i] = finalValue;     // R
            data[i + 1] = finalValue; // G 
            data[i + 2] = finalValue; // B
        }
        
        ctx.putImageData(imageData, 0, 0);
        variants.push({
            buffer: canvas.toBuffer('image/png'),
            config: {
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-:/+<> ',
                tessedit_pageseg_mode: '6',
                preserve_interword_spaces: '1'
            },
            type: 'high-contrast'
        });
    } catch (error) {
        console.error('Error creating high contrast variant:', error);
    }
    
    // Variant 2: Scaled up for better OCR
    try {
        const image = await loadImage(imageBuffer);
        const canvas = createCanvas(image.width * 2, image.height * 2);
        const ctx = canvas.getContext('2d');
        
        // Use high quality scaling
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        variants.push({
            buffer: canvas.toBuffer('image/png'),
            config: {
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-:/+<> ',
                tessedit_pageseg_mode: '6',
                preserve_interword_spaces: '1'
            },
            type: 'scaled-up'
        });
    } catch (error) {
        console.error('Error creating scaled up variant:', error);
    }
    
    return variants;
}

async function performMultiOCR(imageBuffer) {
    // Get all image variants
    const imageVariants = await preprocessImageWithVariants(imageBuffer);
    
    let bestResult = null;
    let highestConfidence = 0;
    let bestLabValues = {};
    
    // Try OCR on each variant
    for (const variant of imageVariants) {
        console.log(`Trying OCR with ${variant.type} variant...`);
        const result = await performOCR(variant);
        
        const confidence = result.data?.confidence || 0;
        const labValueCount = Object.keys(result.labValues || {}).length;
        
        console.log(`${variant.type} variant results: confidence=${confidence}%, lab values=${labValueCount}`);
        
        // Determine if this is the best result based on confidence and number of lab values found
        const score = confidence * (1 + labValueCount);
        if (score > highestConfidence) {
            highestConfidence = score;
            bestResult = result;
            bestLabValues = result.labValues;
        }
    }
    
    return {
        text: bestResult?.data?.text || '',
        labValues: bestLabValues,
        confidence: bestResult?.data?.confidence || 0
    };
}

async function performOCR(imageResult) {
    const worker = await createWorker();
    try {
        await worker.setParameters(imageResult.config || {});
        const { data } = await worker.recognize(imageResult.buffer);
        
        console.log(`OCR with ${imageResult.type} variant - confidence: ${data.confidence}%`);
        
        // Parse lab values
        const labValues = parseLabValues(data.text);
        
        // Add confidence metadata
        Object.keys(labValues).forEach(key => {
            labValues[key].confidence = data.confidence / 100;
            labValues[key].confidenceLevel = interpretConfidence(data.confidence);
        });

        return { data, labValues };
    } finally {
        await worker.terminate();
    }
}

// 1. Update extractFromImage function
async function extractFromImage(filePath) {
    try {
        const imageBuffer = fs.readFileSync(filePath);
        // Use multi-attempt OCR instead of preprocessing+single OCR
        const results = await performMultiOCR(imageBuffer);
        
        return {
            labValues: results.labValues,
            testDate: extractTestDate(results.text)
        };
    } catch (error) {
        console.error('Error extracting from image:', error);
        throw error;
    }
}

// 2. Update extractFromFile function
async function extractFromFile(filePath) {
    try {
        const extension = path.extname(filePath).toLowerCase();
        
        if (['.jpg', '.jpeg', '.png'].includes(extension)) {
            // Use extractFromImage for image files
            return await extractFromImage(filePath);
        } else {
            // Use extractFromPDF for PDF files
            return await extractFromPDF(filePath);
        }
    } catch (error) {
        console.error(`Error processing file ${path.basename(filePath)}:`, error);
        throw error;
    }
}

// 3. Update extractFromPDF function
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

                // Use multi-attempt OCR instead of single attempt
                const results = await performMultiOCR(canvas.toBuffer('image/png'));
                
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
    preprocessImageWithVariants,
    extractFromPDF,
    extractFromFile, 
    extractFromImage,
    parseLabValues,
    extractTestDate
};