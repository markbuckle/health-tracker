// EasyOCR implementation for lab document processing
// This parser uses EasyOCR for better text recognition in medical lab documents

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { labPatterns, datePatterns, enhancedPatterns, structuredTestPatterns } = require('../labPatterns');

// Configuration for debug mode
const DEBUG = process.env.DEBUG_OCR === 'true';

/**
 * Extract data from PDF using EasyOCR
 * @param {string} filePath - Path to the PDF file
 * @returns {Promise<Object>} Extracted lab values and test date
 */
async function extractFromPDF(filePath) {
    try {
        console.log(`Processing file: ${filePath}`);
        
        // Determine file extension
        const fileExt = path.extname(filePath).toLowerCase();
        const isImage = ['.jpg', '.jpeg', '.png', '.tiff', '.bmp'].includes(fileExt);
        const isPDF = fileExt === '.pdf';
        
        if (!isImage && !isPDF) {
            throw new Error(`Unsupported file format: ${fileExt}. Please upload a PDF or image file.`);
        }
        
        // Run EasyOCR via Python
        const extractedText = await runEasyOCR(filePath, isImage);
        
        // Save text to file for debugging if needed
        if (DEBUG) {
            const debugOutputPath = path.join(path.dirname(filePath), 'debug_ocr_output.txt');
            fs.writeFileSync(debugOutputPath, extractedText);
            console.log(`Saved full OCR text to ${debugOutputPath} for debugging`);
        }
        
        console.log('Starting to parse lab values from text');
        console.log(`Sample text: ${extractedText.substring(0, 100)}...`);
        console.log(`Line count: ${extractedText.split('\n').length}`);
        
        // Extract lab values and test date
        const labValues = parseLabValues(extractedText);
        const testDate = extractTestDate(extractedText);
        
        return {
            labValues,
            testDate
        };
    } catch (error) {
        console.error('Error extracting from file with EasyOCR:', error);
        throw error;
    }
}

/**
 * Run EasyOCR on a file via Python subprocess
 * @param {string} filePath - Path to the file
 * @param {boolean} isImage - Whether the file is an image
 * @returns {Promise<string>} Extracted text
 */
async function runEasyOCR(filePath, isImage) {
    return new Promise((resolve, reject) => {
        // Create a temporary Python script to avoid command line issues
        const tempScriptPath = path.join(path.dirname(filePath), 'run_easyocr.py');
        
        // Prepare Python script content
        const pythonScript = `
import sys
import os
import easyocr
import traceback

# Function to process image files
def process_image(image_path):
    try:
        # Initialize the EasyOCR reader for English
        print("Initializing EasyOCR reader...")
        reader = easyocr.Reader(['en'])
        
        # Run OCR on the image
        print(f"Processing file: {image_path}")
        results = reader.readtext(image_path, detail=0)
        
        # Join all text blocks with newlines
        text = '\\n'.join(results)
        
        print(f"EasyOCR extracted {len(text)} characters of text")
        print(f"Sample extracted text: {text[:100]}...")
        
        return text
    except Exception as e:
        error_msg = f"Error processing image: {str(e)}\\n{traceback.format_exc()}"
        print(error_msg)
        return error_msg

# Function to process PDF files
def process_pdf(pdf_path):
    try:
        import fitz  # PyMuPDF
        import tempfile
        from PIL import Image
        
        # Open the PDF
        print(f"Processing file: {pdf_path}")
        pdf_document = fitz.open(pdf_path)
        
        all_text = []
        
        # Initialize EasyOCR reader just once
        print("Initializing EasyOCR reader...")
        reader = easyocr.Reader(['en'])
        
        # Process each page
        for page_num in range(pdf_document.page_count):
            page = pdf_document[page_num]
            
            # Get a pixmap (image) of the page
            pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x scaling for better OCR
            
            # Save to a temporary image file
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_img:
                temp_img_path = temp_img.name
                pix.save(temp_img_path)
            
            # OCR the page image
            page_results = reader.readtext(temp_img_path, detail=0)
            page_text = '\\n'.join(page_results)
            all_text.append(page_text)
            
            # Clean up temporary image
            os.unlink(temp_img_path)
            
        # Combine all page texts
        full_text = '\\n\\n'.join(all_text)
        
        print(f"EasyOCR extracted {len(full_text)} characters of text")
        print(f"Sample extracted text: {full_text[:100]}...")
        
        return full_text
    except ImportError:
        # Fall back to using pdf2image if PyMuPDF is not available
        try:
            from pdf2image import convert_from_path
            import tempfile
            
            all_text = []
            
            # Convert PDF to images
            images = convert_from_path(pdf_path, dpi=200)
            
            # Initialize EasyOCR reader
            print("Initializing EasyOCR reader...")
            reader = easyocr.Reader(['en'])
            
            # Process each page image
            for i, image in enumerate(images):
                # Save to a temporary file
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_img:
                    temp_img_path = temp_img.name
                    image.save(temp_img_path, 'PNG')
                
                # OCR the page image
                page_results = reader.readtext(temp_img_path, detail=0)
                page_text = '\\n'.join(page_results)
                all_text.append(page_text)
                
                # Clean up temporary image
                os.unlink(temp_img_path)
            
            # Combine all page texts
            full_text = '\\n\\n'.join(all_text)
            
            print(f"EasyOCR extracted {len(full_text)} characters of text")
            print(f"Sample extracted text: {full_text[:100]}...")
            
            return full_text
        except Exception as e:
            error_msg = f"Error processing PDF: {str(e)}\\n{traceback.format_exc()}"
            print(error_msg)
            return error_msg
    except Exception as e:
        error_msg = f"Error processing PDF: {str(e)}\\n{traceback.format_exc()}"
        print(error_msg)
        return error_msg

# Main execution
try:
    file_path = "${filePath.replace(/\\/g, '\\\\')}"
    is_image = ${isImage}
    
    if is_image:
        result = process_image(file_path)
    else:
        result = process_pdf(file_path)
    
    # Print result to stdout for Node.js to capture
    print(result)
except Exception as e:
    print(f"Python execution error: {str(e)}\\n{traceback.format_exc()}")
    sys.exit(1)
`;
        
        // Debug: Log the script content to see what's being generated
        console.log('\n--- START OF PYTHON SCRIPT ---');
        console.log(`Python script with is_image = ${isImage ? 'True' : 'False'}`);
        console.log('--- END OF PYTHON SCRIPT ---\n');
        
        // Fix boolean values for Python
        let processedScript = pythonScript.replace(
            /is_image = \${isImage}/g, 
            `is_image = ${isImage ? 'True' : 'False'}`
        );
        
        // Write temporary Python script with fixed boolean values
        fs.writeFileSync(tempScriptPath, processedScript);
        console.log(`Created temporary Python script at ${tempScriptPath}`);
        
        // Double-check the script content
        const scriptContent = fs.readFileSync(tempScriptPath, 'utf8');
        if (scriptContent.includes('is_image = false') || scriptContent.includes('is_image = true')) {
            console.error('WARNING: Python script contains JavaScript booleans instead of Python booleans!');
            console.log('Attempting to fix the script before running...');
            
            // Direct replacement to fix the script
            const fixedScript = scriptContent
                .replace(/is_image = false/g, 'is_image = False')
                .replace(/is_image = true/g, 'is_image = True');
            
            fs.writeFileSync(tempScriptPath, fixedScript);
            console.log('Script fixed with direct replacement.');
        }
        
        // Check which Python executable to use
        const pythonCommands = ['python', 'python3', 'py'];
        let pythonCommand = null;
        
        // Try to find a working Python command
        for (const cmd of pythonCommands) {
            try {
                const result = require('child_process').spawnSync(cmd, ['-c', 'print("Python works")']);
                if (result.status === 0) {
                    pythonCommand = cmd;
                    console.log(`Found working Python command: ${cmd}`);
                    break;
                }
            } catch (err) {
                console.log(`Command ${cmd} not available: ${err.message}`);
            }
        }
        
        if (!pythonCommand) {
            return reject(new Error('No working Python command found. Please make sure Python is installed and in your PATH.'));
        }
        
        // Check if required Python packages are installed
        try {
            const checkPackages = require('child_process').spawnSync(pythonCommand, ['-c', 'import easyocr; print("EasyOCR is available")']);
            if (checkPackages.status !== 0) {
                console.error(`Error checking for EasyOCR: ${checkPackages.stderr?.toString()}`);
                return reject(new Error('EasyOCR is not properly installed. Please run: pip install easyocr'));
            }
        } catch (err) {
            console.error(`Error checking Python packages: ${err.message}`);
        }
        
        console.log(`Executing Python script at ${tempScriptPath} using ${pythonCommand}...`);
        
        // Execute the Python script with additional debug output
        const pythonProcess = spawn(pythonCommand, [tempScriptPath]);
        
        let textOutput = '';
        let errorOutput = '';
        
        // Capture standard output
        pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            textOutput += chunk;
            console.log(`Python output: ${chunk}`);
        });
        
        // Capture error output
        pythonProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            errorOutput += chunk;
            console.error(`Python error: ${chunk}`);
        });
        
        // Handle process completion
        pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
            
            // Clean up temporary script
            try {
                fs.unlinkSync(tempScriptPath);
                console.log(`Removed temporary script ${tempScriptPath}`);
            } catch (err) {
                console.error(`Error removing temporary script: ${err.message}`);
            }
            
            if (code !== 0) {
                console.error(`Python execution failed with code ${code}`);
                console.error(`Error output: ${errorOutput || 'No error output'}`);
                
                // Provide more helpful error message based on common issues
                let errorMsg = 'Python execution failed';
                if (errorOutput.includes('No module named')) {
                    errorMsg += `: Missing Python module. Please run: pip install -r ${path.join(path.dirname(__dirname), 'EasyOCR', 'requirements.txt')}`;
                } else if (errorOutput.includes('poppler')) {
                    errorMsg += `: Poppler not found. Please install Poppler and add it to your PATH.`;
                } else if (errorOutput) {
                    errorMsg += `: ${errorOutput.split('\n')[0]}`;
                }
                
                reject(new Error(errorMsg));
                return;
            }
            
            // Extract the actual OCR result from the output
            console.log(`Successfully received ${textOutput.length} characters of OCR text`);
            resolve(textOutput);
        });
        
        // Handle process errors (like failure to spawn)
        pythonProcess.on('error', (err) => {
            console.error(`Failed to start Python process: ${err.message}`);
            reject(new Error(`Failed to start Python process: ${err.message}`));
        });
    });
}

/**
 * Parse lab values from the OCR text
 * @param {string} text - OCR extracted text
 * @returns {Object} Parsed lab values
 */
function parseLabValues(text) {
    const results = {};
    
    if (!text || typeof text !== 'string') {
        console.error('Invalid text provided to parseLabValues');
        return results;
    }
    
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n');
    
    // Try enhanced testosterone patterns first
    for (const [testName, pattern] of Object.entries(enhancedPatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                const value = parseFloat(match[1]);
                if (!isNaN(value) && value > 0 && value < 10000) { // Sanity check
                    console.log(`Found enhanced match for ${testName}: ${value}`);
                    
                    // Try to find reference range
                    const refRangeMatch = normalizedText.match(
                        new RegExp(`${testName}.*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`)
                    );
                    
                    results[testName] = {
                        value: value.toFixed(pattern.precision || 2),
                        unit: pattern.standardUnit,
                        rawText: match[0].trim(),
                        referenceRange: refRangeMatch ? refRangeMatch[1] : null,
                        confidence: 0.95,
                        matchType: 'enhanced'
                    };
                }
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }
    
    // Try structured test patterns
    for (const [testName, pattern] of Object.entries(structuredTestPatterns)) {
        if (results[testName]) continue; // Skip if already found
        
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                const value = parseFloat(match[1]);
                if (!isNaN(value) && value > 0 && value < 10000) { // Sanity check
                    console.log(`Found structured match for ${testName}: ${value}`);
                    
                    // Try to find reference range
                    let refRange = null;
                    if (pattern.referencePattern) {
                        const refMatch = pattern.referencePattern.exec(normalizedText);
                        if (refMatch) {
                            refRange = refMatch[1];
                        }
                    }
                    
                    results[testName] = {
                        value: value.toFixed(pattern.precision || 2),
                        unit: pattern.standardUnit,
                        rawText: match[0].trim(),
                        referenceRange: refRange,
                        confidence: 0.9,
                        matchType: 'structured'
                    };
                }
            }
        } catch (error) {
            console.error(`Error parsing structured test ${testName}:`, error);
        }
    }
    
    // Try standard patterns
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        if (results[testName]) continue; // Skip if already found
        
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                const value = parseFloat(match[1]);
                if (!isNaN(value) && value > 0 && value < 10000) { // Sanity check
                    console.log(`Found standard match for ${testName}: ${value}`);
                    
                    // Look for reference range in the same line
                    const matchLine = lines.find(line => line.includes(match[0])) || '';
                    const refRangeMatch = matchLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                    
                    results[testName] = {
                        value: value.toFixed(pattern.precision || 2),
                        unit: pattern.standardUnit,
                        rawText: matchLine.trim(),
                        referenceRange: refRangeMatch ? refRangeMatch[0] : null,
                        confidence: 0.85,
                        matchType: 'standard'
                    };
                }
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }
    
    // Try fuzzy matching for potential missed values
    const wordMap = createWordMap(text);
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        if (results[testName]) continue; // Skip if already found
        
        try {
            // Try both the main name and alternate names
            const allNames = [testName, ...(pattern.alternateNames || [])];
            
            for (const name of allNames) {
                const bestMatch = findBestFuzzyMatch(name, wordMap);
                if (bestMatch) {
                    const value = parseFloat(bestMatch.value);
                    if (!isNaN(value) && value > 0 && value < 10000) { // Sanity check
                        console.log(`Found fuzzy match for ${testName}: ${value}`);
                        
                        results[testName] = {
                            value: value.toFixed(pattern.precision || 2),
                            unit: pattern.standardUnit,
                            rawText: bestMatch.context,
                            referenceRange: bestMatch.range,
                            confidence: 0.7,
                            matchType: 'fuzzy'
                        };
                        break; // Found a match, no need to try other alternate names
                    }
                }
            }
        } catch (error) {
            console.error(`Error with fuzzy matching for ${testName}:`, error);
        }
    }
    
    // Log summary of results
    console.log('EasyOCR parsed results:', {
        totalValues: Object.keys(results).length,
        foundTests: Object.keys(results)
    });
    
    return results;
}

/**
 * Create a map of words for fuzzy matching
 * @param {string} text - The OCR text
 * @returns {Object} Word map with words as keys
 */
function createWordMap(text) {
    const words = {};
    const lines = text.split('\n');
    
    lines.forEach(line => {
        // Split line into tokens
        const tokens = line.split(/\s+/);
        
        tokens.forEach((token, index) => {
            // Look for number patterns near words
            if (/^[A-Za-z]+$/.test(token) && token.length >= 2) {
                // Look ahead for numbers in the next few tokens
                for (let i = 1; i <= 3 && index + i < tokens.length; i++) {
                    const nextToken = tokens[index + i];
                    // Check if token is a number
                    if (/^\d+\.?\d*$/.test(nextToken)) {
                        // Store the word with its context and value
                        words[token.toLowerCase()] = {
                            word: token,
                            value: nextToken,
                            context: line,
                            range: findReferenceRange(line)
                        };
                        break; // Found a value, no need to look further
                    }
                }
            }
        });
    });
    
    return words;
}

/**
 * Find reference range pattern in text
 * @param {string} text - Text to search for reference range
 * @returns {string|null} - Reference range or null
 */
function findReferenceRange(text) {
    const rangePattern = /(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/;
    const match = text.match(rangePattern);
    return match ? match[0] : null;
}

/**
 * Find best fuzzy match for a lab name
 * @param {string} labName - Lab name to match
 * @param {Object} wordMap - Word map to search
 * @returns {Object|null} - Best match info or null
 */
function findBestFuzzyMatch(labName, wordMap) {
    const normalizedLabName = labName.toLowerCase();
    let bestMatch = null;
    let bestScore = Infinity;
    
    // Check for exact matches first
    if (wordMap[normalizedLabName]) {
        return wordMap[normalizedLabName];
    }
    
    // Try fuzzy matching
    for (const [word, info] of Object.entries(wordMap)) {
        const distance = levenshteinDistance(normalizedLabName, word);
        const score = distance / Math.max(normalizedLabName.length, word.length);
        
        // Consider a match if the normalized score is less than 0.3 (70% similar)
        if (score < 0.3 && score < bestScore) {
            bestScore = score;
            bestMatch = info;
        }
    }
    
    return bestMatch;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Levenshtein distance
 */
function levenshteinDistance(a, b) {
    if (!a || !b) return Infinity;
    
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
 * @param {string} text - OCR text
 * @returns {Date|null} - Extracted date or null
 */
function extractTestDate(text) {
    if (!text || typeof text !== 'string') {
        console.log('Invalid text provided to extractTestDate');
        return null;
    }

    // Various date patterns to try
    const datePatterns = [
        // Pattern: "Collection Date: YYYY-MM-DD"
        {
            regex: /Collection\s+Date:?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2})/i,
            priority: 1
        },
        // Pattern: "Date: YYYY-MM-DD"
        {
            regex: /Date:?\s*(\d{4}-\d{2}-\d{2}|\d{2}-\d{2}-\d{4}|\d{2}\/\d{2}\/\d{4}|\d{4}\/\d{2}\/\d{2})/i,
            priority: 2
        },
        // Pattern: "Collection Date: DD-MMM-YYYY"
        {
            regex: /Collection\s+Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})/i,
            priority: 3
        },
        // Pattern: "Collected Date: DD-MMM-YYYY"
        {
            regex: /Collected\s+Date:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})/i,
            priority: 4
        },
        // Pattern: "Generated On: DD-MMM-YYYY"
        {
            regex: /Generated\s+On:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})/i,
            priority: 5
        },
        // Pattern: "Received: DD-MMM-YYYY"
        {
            regex: /Received:?\s*(\d{2}-[A-Za-z]{3}-\d{4}|\d{4}-[A-Za-z]{3}-\d{2})/i,
            priority: 6
        }
    ];

    // Sort patterns by priority
    const sortedPatterns = [...datePatterns].sort((a, b) => a.priority - b.priority);

    for (const pattern of sortedPatterns) {
        const match = pattern.regex.exec(text);
        if (match) {
            try {
                const dateStr = match[1].trim();
                
                // Handle different date formats
                if (dateStr.includes('-')) {
                    // Format: YYYY-MM-DD or DD-MM-YYYY or DD-MMM-YYYY
                    const parts = dateStr.split('-');
                    
                    if (parts.length === 3) {
                        // Check if first part is year (YYYY-MM-DD)
                        if (parts[0].length === 4) {
                            return new Date(parts[0], parts[1] - 1, parts[2]);
                        }
                        // Check if it's DD-MMM-YYYY format
                        else if (parts[1].length === 3 && isNaN(parseInt(parts[1]))) {
                            const monthMap = {
                                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
                            };
                            const month = monthMap[parts[1].toLowerCase()];
                            if (month !== undefined) {
                                return new Date(parts[2], month, parts[0]);
                            }
                        }
                        // Assume DD-MM-YYYY
                        else {
                            return new Date(parts[2], parts[1] - 1, parts[0]);
                        }
                    }
                } 
                else if (dateStr.includes('/')) {
                    // Format: MM/DD/YYYY or DD/MM/YYYY
                    const parts = dateStr.split('/');
                    
                    if (parts.length === 3) {
                        // Check if third part is year (MM/DD/YYYY or DD/MM/YYYY)
                        if (parts[2].length === 4) {
                            // Try to determine if MM/DD or DD/MM based on numbers
                            const num1 = parseInt(parts[0]);
                            const num2 = parseInt(parts[1]);
                            
                            if (num1 > 12 && num2 <= 12) {
                                // First number > 12, so it must be DD/MM/YYYY
                                return new Date(parts[2], parts[1] - 1, parts[0]);
                            } else {
                                // Otherwise assume MM/DD/YYYY (US format)
                                return new Date(parts[2], parts[0] - 1, parts[1]);
                            }
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

/**
 * Interpret OCR confidence level
 * @param {number} confidence - Confidence score (0-1)
 * @returns {string} - Confidence level description
 */
function interpretConfidence(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.75) return 'medium';
    return 'low';
}

// Export required functions for the parser
module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence
};