const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');
const pdf = require('pdf-parse');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');
const { createCanvas, loadImage } = require('canvas');

// Import patterns from labPatterns
const { labPatterns, datePatterns, enhancedPatterns, structuredTestPatterns } = require('./labPatterns');

// Mozilla's PDF.js project - allows viewing PDFs directly in the browers w/o plugins
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.js');

// Add this function to labParser.js
function extractStructuredLabValues(text) {
    const lines = text.split('\n');
    const results = {};
    
    // Look for patterns that indicate a structured lab report
    // Pattern 1: Tables with headers like "TEST NAME | RESULT | FLAG | REFERENCE | UNITS"
    let tableSection = false;
    let headers = {};
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Try to detect table headers
        if (line.match(/TEST\s*NAME|RESULT|REFERENCE|FLAG|UNITS/i)) {
            tableSection = true;
            
            // Map column positions
            const headerLine = line.toLowerCase();
            headers = {
                testName: headerLine.indexOf('test name'),
                result: headerLine.indexOf('result'),
                reference: headerLine.indexOf('reference'),
                units: headerLine.indexOf('units'),
                flag: headerLine.indexOf('flag')
            };
            
            continue;
        }
        
        // If we're in a table section, try to parse rows
        if (tableSection && line.length > 10) {
            try {
                // Extract test name - it's usually at the beginning of the line
                let testName = '';
                if (headers.testName >= 0) {
                    const nextCol = Math.min(...Object.values(headers).filter(pos => pos > headers.testName && pos >= 0));
                    testName = line.substring(headers.testName, nextCol).trim();
                } else {
                    // If no header positioning, try to extract first part before numbers
                    const matches = line.match(/^([A-Za-z\s\-\(\)]+)[\s:]*(\d+\.?\d*)/);
                    if (matches) {
                        testName = matches[1].trim();
                    }
                }
                
                if (!testName) continue;
                
                // Extract result value
                let resultValue = '';
                if (headers.result >= 0) {
                    const nextCol = Math.min(...Object.values(headers).filter(pos => pos > headers.result && pos >= 0));
                    resultValue = line.substring(headers.result, nextCol !== Infinity ? nextCol : undefined).trim();
                } else {
                    // Try to extract first number in the line
                    const matches = line.match(/(\d+\.?\d*)/);
                    if (matches) {
                        resultValue = matches[1];
                    }
                }
                
                // Try to extract reference range
                let refRange = '';
                if (headers.reference >= 0) {
                    const nextCol = Math.min(...Object.values(headers).filter(pos => pos > headers.reference && pos >= 0));
                    refRange = line.substring(headers.reference, nextCol !== Infinity ? nextCol : undefined).trim();
                    // Look for a pattern like "0-8" or "0.5-1.2"
                    const rangeMatch = refRange.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                    if (rangeMatch) {
                        refRange = rangeMatch[0];
                    }
                }
                
                // Extract units
                let units = '';
                if (headers.units >= 0) {
                    units = line.substring(headers.units).trim();
                }
                
                // Only add if we have a test name and result
                if (testName && resultValue && !isNaN(parseFloat(resultValue))) {
                    // Find standard name if possible
                    let standardName = testName;
                    for (const [name, pattern] of Object.entries(labPatterns)) {
                        if (pattern.alternateNames && 
                            (pattern.alternateNames.some(alt => 
                                testName.toLowerCase().includes(alt.toLowerCase())
                            ) || testName.toLowerCase().includes(name.toLowerCase()))) {
                            standardName = name;
                            break;
                        }
                    }
                    
                    results[standardName] = {
                        value: parseFloat(resultValue).toFixed(2),
                        unit: units,
                        referenceRange: refRange,
                        confidence: 1,
                        matchType: 'structured'
                    };
                    
                    console.log(`Found structured table match: ${standardName} = ${resultValue} ${units} (Range: ${refRange})`);
                }
            } catch (error) {
                console.error('Error parsing structured table row:', error);
            }
        }
    }
    
    return results;
}

// parsing - extracting and intrepretting
function parseLabValues(text) {
    const results = {};
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n');
    
    // Debug logging
    console.log('Starting lab value parsing...');
    
    // Add a validation function to filter unreasonable values
    const isReasonableValue = (value, testName) => {
        const num = parseFloat(value);
        if (isNaN(num)) return false;
        
        // Avoid extremes based on test type
        if (num > 10000) return false; // Filter out extremely large values
        
        // Specific test ranges
        if (testName.includes('Testosterone') && (num < 0.1 || num > 50)) return false;
        if (testName.includes('Calcium') && (num < 0.5 || num > 5)) return false;
        if (testName.includes('Potassium') && (num < 0.5 || num > 10)) return false;
        
        return true;
    };

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

                if (testName && value && isReasonableValue(value, testName)) {
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

    // Then try enhanced testosterone patterns
    for (const [testName, pattern] of Object.entries(enhancedPatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match && isReasonableValue(match[1], testName)) {
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

    // Try structured test patterns
    for (const [testName, pattern] of Object.entries(structuredTestPatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match && isReasonableValue(match[1], testName)) {
                console.log(`Found structured match: ${testName} = ${match[1]}`);
                
                let refRange = null;
                if (pattern.referencePattern) {
                    const refMatch = pattern.referencePattern.exec(normalizedText);
                    if (refMatch) {
                        refRange = refMatch[1];
                    }
                }
                
                results[testName] = {
                    value: Number(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: match[0].trim(),
                    referenceRange: refRange,
                    confidence: 1,
                    matchType: 'structured'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Finally try standard patterns for remaining values
    // for (const [testName, pattern] of Object.entries(labPatterns)) {
    //     // Skip if already found by other methods
    //     if (results[testName]) continue;

    //     try {
    //         const match = pattern.regex.exec(normalizedText);
    //         if (match && isReasonableValue(match[1], testName)) {
    //             const matchLine = lines.find(line => line.includes(match[0])) || '';
    //             const refRangeMatch = matchLine.match(/\d+\.?\d*\s*[-–]\s*\d+\.?\d*/);

    //             results[testName] = {
    //                 value: parseFloat(match[1]).toFixed(pattern.precision || 2),
    //                 unit: pattern.standardUnit,
    //                 rawText: matchLine.trim(),
    //                 referenceRange: refRangeMatch ? refRangeMatch[0] : null,
    //                 confidence: 1,
    //                 matchType: 'standard'
    //             };
    //             console.log(`Found standard match: ${testName} = ${match[1]}`);
    //         }
    //     } catch (error) {
    //         console.error(`Error parsing ${testName}:`, error);
    //     }
    // }

    // In the "standard patterns" section of parseLabValues function:

    // In parseLabValues function, modify the standard patterns section:
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        if (results[testName]) continue;

        try {
            const match = pattern.regex.exec(normalizedText);
            if (match && isReasonableValue(match[1], testName)) {
                const matchLine = lines.find(line => line.includes(match[0])) || '';
                
                // Look more aggressively for reference ranges
                let refRange = null;
                
                // First try to find it in the same line
                const refRangeMatch = matchLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                if (refRangeMatch) {
                    refRange = refRangeMatch[0];
                } else {
                    // Try looking in nearby lines (2 before and 2 after)
                    const lineIndex = lines.findIndex(line => line.includes(match[0]));
                    if (lineIndex >= 0) {
                        for (let i = Math.max(0, lineIndex - 2); i <= Math.min(lines.length - 1, lineIndex + 2); i++) {
                            const nearbyLine = lines[i];
                            // Look for text like "Reference" or "Range" with nearby numbers
                            const rangeHeaderMatch = nearbyLine.match(/Ref(?:erence)?\s*Range/i);
                            if (rangeHeaderMatch) {
                                const rangeMatch = nearbyLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                                if (rangeMatch) {
                                    refRange = rangeMatch[0];
                                    break;
                                }
                            } else {
                                // Still try regular format if no header
                                const regularRangeMatch = nearbyLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                                if (regularRangeMatch && !nearbyLine.includes(match[0])) {
                                    refRange = regularRangeMatch[0];
                                    break;
                                }
                            }
                        }
                    }
                }

                results[testName] = {
                    value: parseFloat(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: matchLine.trim(),
                    referenceRange: refRange,
                    confidence: 1,
                    matchType: 'standard'
                };
                console.log(`Found standard match: ${testName} = ${match[1]}, range: ${refRange}`);
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Log final results
    console.log('Parsed results:', {
        totalValues: Object.keys(results).length,
        foundTests: Object.keys(results),
        details: results
    });

    return results;
}

// async function preprocessImageWithVariants(imageBuffer) {
//     // Create an array to store multiple processing variants
//     const variants = [];
    
//     // Original image
//     variants.push({
//         buffer: imageBuffer,
//         config: {
//             tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-:/+<> ',
//             tessedit_pageseg_mode: '6', // Assume a single uniform block of text
//             preserve_interword_spaces: '1'
//         },
//         type: 'original'
//     });
    
//     // Variant 1: High contrast
//     try {
//         const image = await loadImage(imageBuffer);
//         const canvas = createCanvas(image.width, image.height);
//         const ctx = canvas.getContext('2d');
        
//         ctx.drawImage(image, 0, 0);
//         const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
//         const data = imageData.data;
        
//         // High contrast
//         for (let i = 0; i < data.length; i += 4) {
//             const brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
//             const contrast = 2.0; // Higher contrast
//             const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
//             const newBrightness = factor * (brightness - 128) + 128;
            
//             const threshold = 128;
//             const finalValue = newBrightness > threshold ? 255 : 0;
            
//             data[i] = finalValue;     // R
//             data[i + 1] = finalValue; // G 
//             data[i + 2] = finalValue; // B
//         }
        
//         ctx.putImageData(imageData, 0, 0);
//         variants.push({
//             buffer: canvas.toBuffer('image/png'),
//             config: {
//                 tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-:/+<> ',
//                 tessedit_pageseg_mode: '6',
//                 preserve_interword_spaces: '1'
//             },
//             type: 'high-contrast'
//         });
//     } catch (error) {
//         console.error('Error creating high contrast variant:', error);
//     }
    
//     // Variant 2: Scaled up for better OCR
//     try {
//         const image = await loadImage(imageBuffer);
//         const canvas = createCanvas(image.width * 2, image.height * 2);
//         const ctx = canvas.getContext('2d');
        
//         // Use high quality scaling
//         ctx.imageSmoothingEnabled = false;
//         ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
//         variants.push({
//             buffer: canvas.toBuffer('image/png'),
//             config: {
//                 tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.-:/+<> ',
//                 tessedit_pageseg_mode: '6',
//                 preserve_interword_spaces: '1'
//             },
//             type: 'scaled-up'
//         });
//     } catch (error) {
//         console.error('Error creating scaled up variant:', error);
//     }
    
//     return variants;
// }

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
    
    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
        // Better grayscale conversion weights
        const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Stronger contrast adjustment
        const contrast = 1.5; // Increased from 1.2
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const newBrightness = factor * (brightness - 128) + 128;
        
        // Adaptive thresholding - use a higher threshold for darker images
        const threshold = brightness < 150 ? 110 : 140;
        const finalValue = newBrightness > threshold ? 255 : 0;
        
        data[i] = finalValue;     // R
        data[i + 1] = finalValue; // G 
        data[i + 2] = finalValue; // B
    }
    
    // Put processed image back
    ctx.putImageData(imageData, 0, 0);
    
    // Scale up image for better OCR - increase the scale factor
    const scaleFactor = 2.5; // Increased from 2
    const scaledCanvas = createCanvas(canvas.width * scaleFactor, canvas.height * scaleFactor);
    const scaledCtx = scaledCanvas.getContext('2d');
    
    // Use better scaling algorithm
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
    
    return scaledCanvas.toBuffer('image/png');
}

// Add to labParser.js
async function tryMultipleProcessingOptions(imageBuffer) {
    // Array to store results from different processing methods
    const allResults = [];
    
    // Method 1: Original image
    try {
        console.log('Trying OCR with original image...');
        const originalResults = await performOCR(imageBuffer);
        allResults.push({
            text: originalResults.text,
            labValues: originalResults.labValues,
            confidence: originalResults.confidence || 0
        });
    } catch (error) {
        console.error('Error with original OCR:', error);
    }
    
    // Method 2: High contrast preprocessing
    try {
        console.log('Trying OCR with high contrast image...');
        const preprocessed = await preprocessImage(imageBuffer);
        const contrastResults = await performOCR(preprocessed);
        allResults.push({
            text: contrastResults.text,
            labValues: contrastResults.labValues,
            confidence: contrastResults.confidence || 0
        });
    } catch (error) {
        console.error('Error with contrast OCR:', error);
    }

    // Merge results, prioritizing higher confidence values
    const mergedLabValues = {};
    for (const result of allResults) {
        if (result.labValues) {
            for (const [testName, value] of Object.entries(result.labValues)) {
                // Only override if new value has higher confidence or has reference range when current doesn't
                if (!mergedLabValues[testName] || 
                    mergedLabValues[testName].confidence < value.confidence ||
                    (!mergedLabValues[testName].referenceRange && value.referenceRange)) {
                    mergedLabValues[testName] = value;
                }
            }
        }
    }
    
    // Combine all text for better date extraction
    const combinedText = allResults.map(r => r.text).join("\n");
    
    return {
        labValues: mergedLabValues,
        text: combinedText,
        confidence: Math.max(...allResults.map(r => r.confidence || 0))
    };
}

async function performMultiOCR(imageBuffer) {
    // Get all image variants
    const imageVariants = await preprocessImage(imageBuffer);
    // const imageVariants = await preprocessImageWithVariants(imageBuffer);
    
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

async function performOCR(imageBuffer) {
    const worker = await createWorker();
    try {
        // Check if imageBuffer is valid
        if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
            console.error('Invalid image buffer provided to OCR');
            return { text: '', labValues: {}, confidence: 0 };
        }

        const { data } = await worker.recognize(imageBuffer);
        const text = data?.text || '';
        const confidence = data?.confidence || 0;
        
        console.log(`Tesseract confidence: ${confidence}%`);

        // Parse lab values only - move testDate extraction to main function
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
// async function extractFromPDF(filePath) {
//     try {
//         const dataBuffer = fs.readFileSync(filePath);
//         let labValues = {};
//         let testDate = null;
        
//         try {
//             const data = await pdf(dataBuffer);
//             if (data.text.trim()) {
//                 console.log('PDF.js extracted text:', data.text);
//                 labValues = parseLabValues(data.text);
//                 testDate = extractTestDate(data.text);
//             }
//         } catch (error) {
//             console.log('PDF.js extraction failed:', error);
//         }

//         if (Object.keys(labValues).length === 0) {
//             console.log('No results from PDF.js, trying OCR...');
//             const pdfDocument = await pdfjsLib.getDocument({ data: dataBuffer }).promise;
//             const numPages = pdfDocument.numPages;
//             let allResults = {};
            
//             for (let pageNum = 1; pageNum <= numPages; pageNum++) {
//                 console.log(`Processing page ${pageNum} of ${numPages}`);
//                 const page = await pdfDocument.getPage(pageNum);
//                 const viewport = page.getViewport({ scale: 2.0 });
//                 const canvas = createCanvas(viewport.width, viewport.height);
//                 const context = canvas.getContext('2d');

//                 await page.render({
//                     canvasContext: context,
//                     viewport: viewport
//                 }).promise;

//                 // Use multi-attempt OCR instead of single attempt
//                 const results = await performMultiOCR(canvas.toBuffer('image/png'));
                
//                 // Try to get test date from first page if we don't have one yet
//                 if (!testDate) {
//                     testDate = extractTestDate(results.text);
//                 }

//                 allResults = { ...allResults, ...results.labValues };
//             }
            
//             labValues = allResults;
//         }

//         return {
//             labValues,
//             testDate
//         };
//     } catch (error) {
//         console.error('Error extracting from PDF:', error);
//         throw error;
//     }
// }

async function extractFromPDF(filePath) {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const fileExt = path.extname(filePath).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png'].includes(fileExt);

        let labValues = {};
        let testDate = null;
        let allOcrResults = []; // Add this line to initialize the array

         // Handle image files differently than PDFs
         if (isImage) {
            console.log('Processing image file...');
            
            // Directly process the image with OCR
            try {
                // Try original image
                console.log('Processing original image...');
                const originalResults = await performOCR(dataBuffer);
                console.log(`Original image OCR confidence: ${originalResults.confidence}%`);
                allOcrResults.push({
                    text: originalResults.text,
                    labValues: originalResults.labValues,
                    confidence: originalResults.confidence
                });
                
                if (originalResults.text) {
                    testDate = extractTestDate(originalResults.text);
                }
                
                // Try with preprocessing
                console.log('Processing preprocessed image...');
                const preprocessedBuffer = await preprocessImage(dataBuffer);
                const preprocessedResults = await performOCR(preprocessedBuffer);
                console.log(`Preprocessed image OCR confidence: ${preprocessedResults.confidence}%`);
                allOcrResults.push({
                    text: preprocessedResults.text,
                    labValues: preprocessedResults.labValues,
                    confidence: preprocessedResults.confidence
                });
                
                if (!testDate && preprocessedResults.text) {
                    testDate = extractTestDate(preprocessedResults.text);
                }
                
            } catch (error) {
                console.error('Error processing image with OCR:', error);
            }
        } else {
            // Existing PDF processing code...
            try {
                const data = await pdf(dataBuffer);
                // ... (rest of your PDF processing code)
            } catch (error) {
                console.log('PDF.js extraction failed:', error);
            }
            
            // ... (rest of your PDF handling code)
        }
                
        // First attempt: Try to extract date from PDF metadata
        try {
            const pdfData = await pdf(dataBuffer);
            if (pdfData && pdfData.info && pdfData.info.CreationDate) {
                // Try to parse PDF creation date
                const dateStr = pdfData.info.CreationDate;
                if (dateStr.startsWith('D:')) {
                    // PDF date format: D:YYYYMMDDHHmmSS
                    const year = parseInt(dateStr.substring(2, 6));
                    const month = parseInt(dateStr.substring(6, 8)) - 1;
                    const day = parseInt(dateStr.substring(8, 10));
                    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
                        testDate = new Date(year, month, day);
                        console.log('Extracted date from PDF metadata:', testDate);
                    }
                }
            }
        } catch (err) {
            console.log('Failed to extract date from PDF metadata:', err);
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

                 // Use multi-pass processing for better results
                const pageBuffer = canvas.toBuffer('image/png');
                const multiPassResults = await tryMultipleProcessingOptions(pageBuffer);

                // Try to get test date from this page if we don't have one yet
                if (!testDate && multiPassResults.text) {
                    testDate = extractTestDate(multiPassResults.text);
                }

                // Try original variant
        //         console.log('Trying OCR with original variant...');
        //         const originalImageBuffer = canvas.toBuffer('image/png');
        //         const originalResults = await performOCR(originalImageBuffer);
        //         console.log(`OCR with original variant - confidence: ${originalResults.confidence}%`);
        //         allOcrResults.push({
        //             text: originalResults.text,
        //             labValues: originalResults.labValues,
        //             confidence: originalResults.confidence
        //         });
                
        //         // Try high-contrast variant
        //         console.log('Trying OCR with high-contrast variant...');
        //         const highContrastBuffer = await preprocessImage(originalImageBuffer);
        //         const highContrastResults = await performOCR(highContrastBuffer);
        //         console.log(`OCR with high-contrast variant - confidence: ${highContrastResults.confidence}%`);
        //         allOcrResults.push({
        //             text: highContrastResults.text,
        //             labValues: highContrastResults.labValues,
        //             confidence: highContrastResults.confidence
        //         });
                
        //         // Try scaled-up variant
        //         console.log('Trying OCR with scaled-up variant...');
        //         const scaledUpBuffer = await preprocessImage(originalImageBuffer);
        //         const scaledUpResults = await performOCR(scaledUpBuffer);
        //         console.log(`OCR with scaled-up variant - confidence: ${scaledUpResults.confidence}%`);
        //         allOcrResults.push({
        //             text: scaledUpResults.text,
        //             labValues: scaledUpResults.labValues,
        //             confidence: scaledUpResults.confidence
        //         });
                
        //         // Try to get test date from this page if we don't have one yet
        //         if (!testDate) {
        //             testDate = extractTestDate(originalResults.text) || 
        //                        extractTestDate(highContrastResults.text) || 
        //                        extractTestDate(scaledUpResults.text);
        //         }
        //     }
        // }
        
        // // Merge and clean up results
        // const mergedLabValues = {};
        // const allTexts = []; // Collect all OCR text
        
        // // 1. Collect all OCR text for date extraction
        // for (const result of allOcrResults) {
        //     if (result.text) {
        //         allTexts.push(result.text);
        //     }
        // }
        
        // // 2. Try to extract date from combined text if not found yet
        // if (!testDate) {
        //     const combinedText = allTexts.join("\n");
        //     testDate = extractTestDate(combinedText);
        // }
        
        // // 3. Merge lab values from all variations, preferring higher confidence entries
        // for (const result of allOcrResults) {
        //     if (result.labValues) {
        //         for (const [testName, value] of Object.entries(result.labValues)) {
        //             // Skip if we have unreasonable values
        //             if (parseFloat(value.value) > 10000) continue;
                    
        //             // Skip if already have a higher confidence value
        //             if (mergedLabValues[testName] && 
        //                 (mergedLabValues[testName].confidence > value.confidence || 
        //                  mergedLabValues[testName].referenceRange && !value.referenceRange)) {
        //                 continue;
        //             }
                    
        //             mergedLabValues[testName] = value;
        //         }
        //     }
        // }

        // // Add this block before returning to set a fallback date if none was found
        // if (!testDate) {
        //     // Fallback: Use filename for date if it contains a date pattern
        //     const filenameDateMatch = path.basename(filePath).match(/(\d{4}[-_.]\d{2}[-_.]\d{2})|(\d{2}[-_.]\d{2}[-_.]\d{4})/);
        //     if (filenameDateMatch) {
        //         const dateStr = filenameDateMatch[0];
        //         const parts = dateStr.split(/[-_.]/);
        //         if (parts.length === 3) {
        //             if (parts[0].length === 4) { // YYYY-MM-DD
        //                 testDate = new Date(parts[0], parts[1] - 1, parts[2]);
        //             } else { // DD-MM-YYYY
        //                 testDate = new Date(parts[2], parts[1] - 1, parts[0]);
        //             }
        //             console.log('Extracted date from filename:', testDate);
        //         }
        //     }
            
        //     // Last resort: If all else fails, use the file's modification date
        //     if (!testDate) {
        //         try {
        //             const stats = fs.statSync(filePath);
        //             testDate = stats.mtime;
        //             console.log('Using file modification date as fallback:', testDate);
        //         } catch (err) {
        //             console.log('Failed to get file stats:', err);
        //             testDate = new Date(); // Absolute last resort: use current date
        //         }
        //     }
        // }
        
                // Merge page results with all results
                allResults = { ...allResults, ...multiPassResults.labValues };
            }
            
            labValues = allResults;
        }
        return {
            // labValues: mergedLabValues || labValues,
            labValues: labValues,
            testDate
        };
    } catch (error) {
        console.error('Error extracting from PDF:', error);
        throw error;
    }
}

// Modify the extractTestDate function to handle more date formats
function extractTestDate(text) {
    if (!text || typeof text !== 'string') {
        console.log('Invalid text provided to extractTestDate');
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

    // Try existing patterns first
    const sortedPatterns = [...datePatterns].sort((a, b) => a.priority - b.priority);
    for (const pattern of sortedPatterns) {
        const match = pattern.regex.exec(text);
        if (match) {
            try {
                const dateStr = match[1].trim();
                // Try to parse the date...
                // [existing parsing code remains unchanged]
            } catch (error) {
                console.log(`Error parsing date: ${error}`);
            }
        }
    }
    
    // If no match found, try extra patterns
    for (const regex of extraDatePatterns) {
        const match = regex.exec(text);
        if (match) {
            try {
                const dateStr = match[1].trim();
                
                // Parse based on date format
                if (dateStr.includes('-')) {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        // YYYY-MM-DD
                        return new Date(dateStr);
                    } else if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
                        // DD-MMM-YYYY
                        const [day, month, year] = dateStr.split('-');
                        const monthMap = {
                            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                        };
                        return new Date(parseInt(year), monthMap[month], parseInt(day));
                    }
                } else if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        // Try to determine format based on values
                        const [part1, part2, part3] = parts.map(p => parseInt(p));
                        
                        if (part1 > 12 && part1 <= 31) {
                            // DD/MM/YYYY
                            return new Date(part3, part2 - 1, part1);
                        } else if (part3 >= 1900 && part3 <= 2100) {
                            // MM/DD/YYYY or DD/MM/YYYY
                            // Assume MM/DD/YYYY if month is valid
                            if (part1 <= 12) {
                                return new Date(part3, part1 - 1, part2);
                            } else {
                                return new Date(part3, part2 - 1, part1);
                            }
                        }
                    }
                }
            } catch (error) {
                console.log(`Error parsing date with extra pattern: ${error}`);
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
    // preprocessImageWithVariants,
    preprocessImage,
    extractFromPDF,
    extractFromFile, 
    extractFromImage,
    parseLabValues,
    extractTestDate,
    tryMultipleProcessingOptions
};