// EasyOCR parser implementation
// This module uses EasyOCR via a Python bridge for fast and accurate OCR

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { labPatterns, datePatterns, enhancedPatterns, structuredTestPatterns } = require('../labPatterns');

// ========== CONFIGURATION ==========
const DEBUG = process.env.DEBUG_OCR === 'true';
const PYTHON_PATH = process.env.PYTHON_PATH || 'python';  // Default to 'python' in PATH
const USE_GPU = process.env.USE_GPU === 'true';
const OCR_LANGUAGES = process.env.OCR_LANGUAGES || 'en';
const CUSTOM_TEMP_DIR = process.env.TEMP_DIR; // Optional custom temp directory

/**
 * Find a working Python command
 * @returns {Promise<string>} The working Python command
 */
async function findPythonCommand() {
    // List of possible Python commands to try
    const commands = ['python', 'python3', 'py'];
    
    // If PYTHON_PATH is set, try that first
    if (PYTHON_PATH !== 'python') {
        commands.unshift(PYTHON_PATH);
    }
    
    for (const cmd of commands) {
        try {
            const result = await new Promise((resolve, reject) => {
                const process = spawn(cmd, ['-c', 'print("Python is working")']);
                
                let stdout = '';
                let stderr = '';
                
                process.stdout.on('data', data => {
                    stdout += data.toString();
                });
                
                process.stderr.on('data', data => {
                    stderr += data.toString();
                });
                
                process.on('close', code => {
                    if (code === 0 && stdout.includes('Python is working')) {
                        resolve({ success: true, command: cmd });
                    } else {
                        resolve({ success: false, error: stderr });
                    }
                });
                
                process.on('error', err => {
                    resolve({ success: false, error: err.message });
                });
            });
            
            if (result.success) {
                if (DEBUG) console.log(`Found working Python command: ${cmd}`);
                return cmd;
            }
        } catch (error) {
            // Continue to next command
        }
    }
    
    throw new Error('Could not find a working Python command. Please install Python or set PYTHON_PATH environment variable.');
}

/**
 * Run EasyOCR via Python script
 * @param {string} filePath - Path to the document to be processed
 * @returns {Promise<Object>} OCR results
 */
async function runEasyOCR(filePath) {
    // Create a temporary script to run EasyOCR
    const scriptPath = path.join(path.dirname(filePath), 'run_easyocr.py');
    
    try {
        // Find the content of the script from our embedded template or from a file
        let scriptContent;
        // Try to get script from our code
        const scriptTemplatePath = path.join(__dirname, 'run_easyocr.py.template');
        if (fs.existsSync(scriptTemplatePath)) {
            scriptContent = fs.readFileSync(scriptTemplatePath, 'utf8');
        } else {
            // If template doesn't exist, use the embedded script content
            scriptContent = `#!/usr/bin/env python3
"""
EasyOCR Document Processing Script

This script processes documents (PDF or image) using EasyOCR and returns the OCR results
as JSON for Node.js to process.
"""

import os
import sys
import json
import tempfile
import argparse
from pathlib import Path
import traceback

# Parse arguments
parser = argparse.ArgumentParser(description='Process documents with EasyOCR')
parser.add_argument('--input', type=str, required=True, help='Path to input document')
parser.add_argument('--output', type=str, help='Path to output JSON file (optional)')
parser.add_argument('--languages', type=str, default='en', help='Languages for OCR (comma-separated)')
parser.add_argument('--gpu', action='store_true', help='Use GPU for processing if available')
parser.add_argument('--debug', action='store_true', help='Enable debug mode')
args = parser.parse_args()

# Set up debugging
DEBUG = args.debug
input_path = args.input
output_path = args.output
use_gpu = args.gpu
languages = args.languages.split(',')

if DEBUG:
    print(f"Processing file: {input_path}")
    print(f"Languages: {languages}")
    print(f"GPU enabled: {use_gpu}")

try:
    # Import required libraries
    import numpy as np
    import cv2
    import easyocr
    import fitz  # PyMuPDF
    from PIL import Image
    
    # Check if the input is a PDF or an image
    input_extension = os.path.splitext(input_path)[1].lower()
    is_pdf = input_extension == '.pdf'
    is_image = not is_pdf
    
    # Initialize EasyOCR reader
    if DEBUG:
        print(f"Initializing EasyOCR with languages: {languages}")
    
    reader = easyocr.Reader(
        languages,
        gpu=use_gpu,
        detector=True,  # Use text detector
        recognizer=True,  # Use text recognizer
        verbose=DEBUG    # Print progress info if in debug mode
    )
    
    # Function to process images with EasyOCR
    def process_image(image_path):
        if DEBUG:
            print(f"Processing image: {image_path}")
        
        # Read the image
        try:
            img = cv2.imread(image_path)
            if img is None:
                # Try with PIL if OpenCV fails
                pil_img = Image.open(image_path)
                img = np.array(pil_img)
                img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
        except Exception as e:
            raise Exception(f"Failed to read image: {str(e)}")
        
        # Run OCR
        if DEBUG:
            print("Running EasyOCR...")
        
        results = reader.readtext(img)
        
        # Extract text and positions
        extracted_text = ""
        all_words = []
        
        for detection in results:
            bbox, text, confidence = detection
            
            # Skip low confidence results
            if confidence < 0.3:
                continue
                
            extracted_text += text + " "
            
            # Add word to detailed output
            all_words.append({
                "text": text,
                "confidence": confidence,
                "bbox": bbox,
            })
        
        return extracted_text.strip(), all_words, sum(word["confidence"] for word in all_words) / len(all_words) if all_words else 0
    
    # Function to process PDFs
    def process_pdf(pdf_path):
        if DEBUG:
            print(f"Processing PDF: {pdf_path}")
        
        try:
            # Open PDF document
            doc = fitz.open(pdf_path)
            
            full_text = ""
            all_words = []
            total_confidence = 0
            total_words = 0
            
            # Process each page
            for page_num in range(len(doc)):
                if DEBUG:
                    print(f"Processing page {page_num+1}/{len(doc)}")
                
                # Get page
                page = doc.load_page(page_num)
                
                # Render page to image
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
                
                # Save to temporary file
                with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp:
                    temp_path = temp.name
                    pix.save(temp_path)
                
                # Process the image
                page_text, page_words, page_confidence = process_image(temp_path)
                
                # Add page number to words
                for word in page_words:
                    word["page"] = page_num
                
                # Add to overall results
                full_text += f"\\n\\n--- PAGE {page_num+1} ---\\n\\n" + page_text
                all_words.extend(page_words)
                
                if page_words:
                    total_confidence += page_confidence
                    total_words += 1
                
                # Clean up temp file
                os.unlink(temp_path)
            
            # Calculate average confidence
            avg_confidence = total_confidence / total_words if total_words > 0 else 0
            
            return full_text.strip(), all_words, avg_confidence
        
        except Exception as e:
            if DEBUG:
                traceback.print_exc()
            raise Exception(f"Failed to process PDF: {str(e)}")
    
    # Process the input file
    if is_pdf:
        text, words, confidence = process_pdf(input_path)
    else:
        text, words, confidence = process_image(input_path)
    
    # Prepare the result
    result = {
        "text": text,
        "confidence": confidence,
        "words": words,
        "pages": 1 if is_image else None  # For images, always 1 page
    }
    
    # If processing a PDF, count actual pages
    if is_pdf:
        try:
            doc = fitz.open(input_path)
            result["pages"] = len(doc)
        except:
            pass
    
    # Output the result
    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2)
        if DEBUG:
            print(f"Results written to {output_path}")
    else:
        # Print JSON to stdout for Node.js to capture
        print(json.dumps(result))
    
    sys.exit(0)  # Success
    
except Exception as e:
    error_message = str(e)
    error_traceback = traceback.format_exc()
    
    # Output the error
    error_result = {
        "error": error_message,
        "traceback": error_traceback
    }
    
    print(json.dumps(error_result), file=sys.stderr)
    sys.exit(1)  # Error
`;
        }
        
        // Write script to temporary file
        fs.writeFileSync(scriptPath, scriptContent);
        console.log(`Created temporary Python script at ${scriptPath}`);
        
        // Find working Python command
        const pythonCommand = await findPythonCommand();
        
        // Prepare args for Python script
        const args = [
            scriptPath,
            '--input', filePath,
            '--languages', OCR_LANGUAGES,
        ];
        
        if (USE_GPU) {
            args.push('--gpu');
        }
        
        if (DEBUG) {
            args.push('--debug');
        }
        
        // Execute Python script
        console.log(`Executing Python script at ${scriptPath} using ${pythonCommand}...`);
        
        const results = await new Promise((resolve, reject) => {
            const process = spawn(pythonCommand, args);
            
            let stdout = '';
            let stderr = '';
            
            process.stdout.on('data', data => {
                stdout += data.toString();
                if (DEBUG) {
                    console.log(`Python output: ${data.toString().trim()}`);
                }
            });
            
            process.stderr.on('data', data => {
                stderr += data.toString();
                console.log(`Python error: ${data.toString().trim()}`);
            });
            
            process.on('close', code => {
                console.log(`Python process exited with code ${code}`);
                
                if (code === 0) {
                    try {
                        const jsonResult = JSON.parse(stdout);
                        resolve(jsonResult);
                    } catch (error) {
                        console.error('Failed to parse JSON output:', error);
                        console.log('Raw output:', stdout);
                        reject(new Error(`Failed to parse JSON output: ${error.message}`));
                    }
                } else {
                    console.error(`Python execution failed with code ${code}`);
                    console.error(`Error output: ${stderr}`);
                    reject(new Error('Python execution failed'));
                }
            });
            
            process.on('error', err => {
                console.error(`Failed to start Python process: ${err.message}`);
                reject(new Error(`Failed to start Python process: ${err.message}`));
            });
        });
        
        return results;
    } catch (error) {
        throw error;
    } finally {
        // Clean up temporary script
        if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
            console.log(`Removed temporary script ${scriptPath}`);
        }
    }
}

/**
 * Parse lab values from OCR text
 * @param {string} text - OCR text
 * @returns {Object} Extracted lab values
 */
function parseLabValues(text) {
    const results = {};
    
    if (!text) {
        console.log("No text provided to parseLabValues");
        return results;
    }
    
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    const lines = text.split('\n');
    
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
                    if (DEBUG) console.log(`Found structured format match: ${testName} = ${value} ${unit}`);
                    results[testName] = {
                        value: parseFloat(value).toFixed(2),
                        unit: unit,
                        rawText: nextLine.trim(),
                        referenceRange: refRange,
                        confidence: 0.95,
                        matchType: 'structured'
                    };
                }
            }
        }
    }

    // Try enhanced patterns
    for (const [testName, pattern] of Object.entries(enhancedPatterns)) {
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                if (DEBUG) console.log(`Found enhanced match: ${testName} = ${match[1]}`);
                const refRangeMatch = normalizedText.match(new RegExp(`${testName}.*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`));
                
                results[testName] = {
                    value: Number(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: match[0].trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[1] : null,
                    confidence: 0.95,
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
            if (match) {
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
                    confidence: 0.95,
                    matchType: 'structured'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Try standard patterns for remaining values
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        // Skip if already found by other methods
        if (results[testName]) continue;

        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                if (DEBUG) console.log(`Found standard match: ${testName} = ${match[1]}`);
                const matchLine = lines.find(line => line.includes(match[0])) || '';
                const refRangeMatch = matchLine.match(/\d+\.?\d*\s*[-–]\s*\d+\.?\d*/);

                results[testName] = {
                    value: parseFloat(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: matchLine.trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[0] : null,
                    confidence: 0.9,
                    matchType: 'standard'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName}:`, error);
        }
    }

    // Log final results
    if (DEBUG) {
        console.log('Parsed results:', {
            totalValues: Object.keys(results).length,
            foundTests: Object.keys(results),
            details: results
        });
    }

    return results;
}

/**
 * Extract test date from OCR text
 * @param {string} text - OCR text
 * @returns {Date|null} Extracted date
 */
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
                
                // Try to parse different date formats
                // Format: YYYY-MM-DD
                if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
                    return new Date(dateStr);
                }
                
                // Format: MM/DD/YYYY or DD/MM/YYYY
                if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
                    const parts = dateStr.split('/');
                    // Try to determine MM/DD/YYYY vs DD/MM/YYYY
                    const month = parseInt(parts[0]);
                    if (month > 12) {
                        // Must be DD/MM/YYYY
                        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        // Assume MM/DD/YYYY (US format)
                        return new Date(`${parts[2]}-${parts[0]}-${parts[1]}`);
                    }
                }
                
                // Format: DD-MMM-YYYY
                if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(dateStr)) {
                    const parts = dateStr.split('-');
                    const monthMap = {
                        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                    };
                    return new Date(parseInt(parts[2]), monthMap[parts[1]], parseInt(parts[0]));
                }
                
                // Other formats could be added here
            } catch (error) {
                console.log(`Error parsing date: ${error}`);
            }
        }
    }
    
    return null;
}

/**
 * Interpret OCR confidence level
 * @param {number} confidence - Confidence value
 * @returns {string} Confidence level (high, medium, low)
 */
function interpretConfidence(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.75) return 'medium';
    return 'low';
}

/**
 * Main function to extract data from a file
 * @param {string} filePath - Path to the file
 * @returns {Promise<{labValues: Object, testDate: Date|null}>} Extracted data
 */
async function extractFromPDF(filePath) {
    try {
        console.log(`Processing file: ${filePath}`);
        
        // Run EasyOCR
        const ocrResults = await runEasyOCR(filePath);
        
        if (!ocrResults.text) {
            throw new Error('No text was extracted from the document');
        }
        
        // Parse lab values and extract test date
        const labValues = parseLabValues(ocrResults.text);
        const testDate = extractTestDate(ocrResults.text);
        
        // Add confidence to lab values
        Object.keys(labValues).forEach(key => {
            if (!labValues[key].confidenceLevel) {
                labValues[key].confidenceLevel = interpretConfidence(ocrResults.confidence);
            }
        });
        
        return {
            labValues,
            testDate
        };
    } catch (error) {
        console.error(`Error extracting from file with EasyOCR: ${error}`);
        throw error;
    }
}

module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence
};