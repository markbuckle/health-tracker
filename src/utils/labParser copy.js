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
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        // Skip if already found by other methods
        if (results[testName]) continue;

        try {
            const match = pattern.regex.exec(normalizedText);
            if (match && isReasonableValue(match[1], testName)) {
                const matchLine = lines.find(line => line.includes(match[0])) || '';
                
                // Try to extract reference range directly from the regex if available (from capture group 2)
                let refRange = match[2];
                
                // If not found in regex, try to find it in the line
                if (!refRange) {
                    // Look for reference range formats like "8.00 - 32.00" or "1.3-4.2"
                    const refRangeMatch = matchLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                    if (refRangeMatch) {
                        refRange = refRangeMatch[0];
                    }
                }

                // For some specific types, search the surrounding lines as well
                if (!refRange && 
                    (testName.includes('Testosterone') || 
                    testName.includes('TSH') || 
                    testName.includes('Creatinine'))) {
                    
                    // Get the line index
                    const lineIndex = lines.findIndex(line => line.includes(match[0]));
                    if (lineIndex >= 0) {
                        // Check surrounding lines (2 before and 2 after)
                        for (let i = Math.max(0, lineIndex - 2); i <= Math.min(lines.length - 1, lineIndex + 2); i++) {
                            const nearbyLine = lines[i];
                            const nearbyRangeMatch = nearbyLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                            if (nearbyRangeMatch && !nearbyLine.includes(match[0])) {
                                refRange = nearbyRangeMatch[0];
                                break;
                            }
                        }
                    }
                }

                results[testName] = {
                    value: parseFloat(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: matchLine.trim(),
                    referenceRange: refRange || null,
                    confidence: 1,
                    matchType: 'standard'
                };
                console.log(`Found standard match: ${testName} = ${match[1]}`);
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

                // Try original variant
                console.log('Trying OCR with original variant...');
                const originalImageBuffer = canvas.toBuffer('image/png');
                const originalResults = await performOCR(originalImageBuffer);
                console.log(`OCR with original variant - confidence: ${originalResults.confidence}%`);
                allOcrResults.push({
                    text: originalResults.text,
                    labValues: originalResults.labValues,
                    confidence: originalResults.confidence
                });
                
                // Try high-contrast variant
                console.log('Trying OCR with high-contrast variant...');
                const highContrastBuffer = await preprocessImage(originalImageBuffer);
                const highContrastResults = await performOCR(highContrastBuffer);
                console.log(`OCR with high-contrast variant - confidence: ${highContrastResults.confidence}%`);
                allOcrResults.push({
                    text: highContrastResults.text,
                    labValues: highContrastResults.labValues,
                    confidence: highContrastResults.confidence
                });
                
                // Try scaled-up variant
                console.log('Trying OCR with scaled-up variant...');
                const scaledUpBuffer = await preprocessImage(originalImageBuffer);
                const scaledUpResults = await performOCR(scaledUpBuffer);
                console.log(`OCR with scaled-up variant - confidence: ${scaledUpResults.confidence}%`);
                allOcrResults.push({
                    text: scaledUpResults.text,
                    labValues: scaledUpResults.labValues,
                    confidence: scaledUpResults.confidence
                });
                
                // Try to get test date from this page if we don't have one yet
                if (!testDate) {
                    testDate = extractTestDate(originalResults.text) || 
                               extractTestDate(highContrastResults.text) || 
                               extractTestDate(scaledUpResults.text);
                }
            }
        }
        
        // Merge and clean up results
        const mergedLabValues = {};
        const allTexts = []; // Collect all OCR text
        
        // 1. Collect all OCR text for date extraction
        for (const result of allOcrResults) {
            if (result.text) {
                allTexts.push(result.text);
            }
        }
        
        // 2. Try to extract date from combined text if not found yet
        if (!testDate) {
            const combinedText = allTexts.join("\n");
            testDate = extractTestDate(combinedText);
        }
        
        // 3. Merge lab values from all variations, preferring higher confidence entries
        for (const result of allOcrResults) {
            if (result.labValues) {
                for (const [testName, value] of Object.entries(result.labValues)) {
                    // Skip if we have unreasonable values
                    if (parseFloat(value.value) > 10000) continue;
                    
                    // Skip if already have a higher confidence value
                    if (mergedLabValues[testName] && 
                        (mergedLabValues[testName].confidence > value.confidence || 
                         mergedLabValues[testName].referenceRange && !value.referenceRange)) {
                        continue;
                    }
                    
                    mergedLabValues[testName] = value;
                }
            }
        }

        // Add this block before returning to set a fallback date if none was found
        if (!testDate) {
            // Fallback: Use filename for date if it contains a date pattern
            const filenameDateMatch = path.basename(filePath).match(/(\d{4}[-_.]\d{2}[-_.]\d{2})|(\d{2}[-_.]\d{2}[-_.]\d{4})/);
            if (filenameDateMatch) {
                const dateStr = filenameDateMatch[0];
                const parts = dateStr.split(/[-_.]/);
                if (parts.length === 3) {
                    if (parts[0].length === 4) { // YYYY-MM-DD
                        testDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    } else { // DD-MM-YYYY
                        testDate = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                    console.log('Extracted date from filename:', testDate);
                }
            }
            
            // Last resort: If all else fails, use the file's modification date
            if (!testDate) {
                try {
                    const stats = fs.statSync(filePath);
                    testDate = stats.mtime;
                    console.log('Using file modification date as fallback:', testDate);
                } catch (err) {
                    console.log('Failed to get file stats:', err);
                    testDate = new Date(); // Absolute last resort: use current date
                }
            }
        }
        
        return {
            labValues: mergedLabValues || labValues,
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

    // Sort patterns by priority
    const sortedPatterns = [...datePatterns].sort((a, b) => a.priority - b.priority);

    for (const pattern of sortedPatterns) {
        const match = pattern.regex.exec(text);
        if (match) {
            try {
                const dateStr = match[1].trim();
                
                // Handle more date formats
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts[0].length === 4) { // YYYY/MM/DD
                        return new Date(parts[0], parts[1] - 1, parts[2]);
                    } else { // DD/MM/YYYY
                        return new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                } else if (dateStr.includes('-')) {
                    // Handle YYYY-MM-DD, DD-MM-YYYY and DD-MMM-YYYY
                    const parts = dateStr.split(/[-\s]/);
                    
                    // Check if middle part is a month name
                    if (parts[1].length === 3 && isNaN(parts[1])) {
                        const monthMap = {
                            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                        };
                        
                        if (parts[0].length === 4) { // YYYY-MMM-DD
                            return new Date(parseInt(parts[0]), monthMap[parts[1]], parseInt(parts[2]));
                        } else { // DD-MMM-YYYY
                            return new Date(parseInt(parts[2]), monthMap[parts[1]], parseInt(parts[0]));
                        }
                    } else {
                        // Handle YYYY-MM-DD or DD-MM-YYYY
                        if (parts[0].length === 4) { // YYYY-MM-DD
                            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        } else { // DD-MM-YYYY
                            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
                        }
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
    // preprocessImageWithVariants,
    preprocessImage,
    extractFromPDF,
    extractFromFile, 
    extractFromImage,
    parseLabValues,
    extractTestDate
};