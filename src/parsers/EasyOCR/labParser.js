// EasyOCR parser - improved text extraction and pattern matching

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { labPatterns, datePatterns, enhancedPatterns, structuredTestPatterns } = require('../labPatterns');

// Configuration
const DEBUG = process.env.DEBUG_OCR === 'true';

/**
 * Parse lab values from OCR text with improved matching logic for EasyOCR output
 * @param {string} text - The OCR processed text
 * @returns {Object} Extracted lab values
 */
function parseLabValues(text) {
    const results = {};
    
    // Ensure text is not null or undefined
    if (!text) {
        console.log("No text provided to parseLabValues");
        return results;
    }

    // Clean and normalize the text
    // EasyOCR may introduce different spacing or line breaks than other OCR engines
    const normalizedText = text
        .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
        .replace(/([a-zA-Z])(\d)/g, '$1 $2')  // Add space between letters and numbers if missing
        .replace(/(\d)([a-zA-Z])/g, '$1 $2')  // Add space between numbers and letters if missing
        .trim();
    
    // Split text into lines for context-aware searching
    const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
    
    if (DEBUG) console.log("Starting to parse lab values from text");
    if (DEBUG) console.log("Sample text:", normalizedText.substring(0, 200) + "...");
    if (DEBUG) console.log("Line count:", lines.length);
    
    // First try structured format patterns
    if (text.includes('TEST') && text.includes('RESULT')) {
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('TEST') && line.includes('RESULT')) {
                // Look for structured data in the next few lines
                for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
                    const dataLine = lines[j];
                    // Simple pattern for test: value format
                    const structuredMatch = dataLine.match(/([A-Za-z\s\-\(\)]+)\s*:?\s*(\d+\.?\d*)\s*([a-zA-Z%\/]+)?/);
                    if (structuredMatch) {
                        const testName = structuredMatch[1].trim();
                        const value = structuredMatch[2];
                        const unit = structuredMatch[3] || '';
                        
                        // Find reference range nearby
                        let refRange = null;
                        for (let k = j; k < Math.min(j + 3, lines.length); k++) {
                            const rangeMatch = lines[k].match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                            if (rangeMatch) {
                                refRange = rangeMatch[0];
                                break;
                            }
                        }
                        
                        // Look for a matching biomarker pattern
                        const biomarkerMatch = findBiomarkerMatch(testName);
                        if (biomarkerMatch) {
                            if (DEBUG) console.log(`Found structured match for ${biomarkerMatch}: ${value} ${unit}`);
                            
                            results[biomarkerMatch] = {
                                value: parseFloat(value).toFixed(2),
                                unit: unit || labPatterns[biomarkerMatch]?.standardUnit || '',
                                rawText: dataLine.trim(),
                                referenceRange: refRange,
                                confidence: 0.9,
                                matchType: 'structured'
                            };
                        }
                    }
                }
                break;
            }
        }
    }
    
    // Try enhanced patterns that are more likely to find values
    for (const [testName, pattern] of Object.entries(enhancedPatterns || {})) {
        // Skip if already found by structured format
        if (results[testName]) continue;
        
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                if (DEBUG) console.log(`Found enhanced match for ${testName}: ${match[1]}`);
                
                // Look for reference range in the same line or nearby
                const matchContext = findContextAroundMatch(text, match[0]);
                const refRangeMatch = matchContext.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                
                results[testName] = {
                    value: parseFloat(match[1]).toFixed(pattern.precision || 2),
                    unit: pattern.standardUnit,
                    rawText: matchContext.trim(),
                    referenceRange: refRangeMatch ? refRangeMatch[0] : null,
                    confidence: 0.95,
                    matchType: 'enhanced'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName} with enhanced patterns:`, error);
        }
    }
    
    // Try looser matching for standard patterns
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        // Skip if already found by other methods
        if (results[testName]) continue;
        
        try {
            // Create a more relaxed pattern with optional spaces
            const patternStr = pattern.regex.toString()
                .replace(/^\/(.*?)\/[gi]*$/, '$1')  // Remove regex delimiters and flags
                .replace(/\s+/g, '\\s*');           // Replace spaces with optional spaces
                
            const relaxedPattern = new RegExp(patternStr, 'i');
            const match = relaxedPattern.exec(normalizedText);
            
            if (match) {
                if (DEBUG) console.log(`Found relaxed match for ${testName}: ${match[1]}`);
                
                // Find the context around this match
                const matchContext = findContextAroundMatch(text, match[0]);
                const refRangeMatch = matchContext.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                
                results[testName] = {
                    value: parseFloat(match[1]).toFixed(2),
                    unit: pattern.standardUnit,
                    rawText: matchContext,
                    referenceRange: refRangeMatch ? refRangeMatch[0] : null,
                    confidence: 0.85,
                    matchType: 'relaxed'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName} with relaxed pattern:`, error);
        }
    }
    
    // Try standard patterns from labPatterns.js as a fallback
    for (const [testName, pattern] of Object.entries(labPatterns)) {
        // Skip if already found by other methods
        if (results[testName]) continue;
        
        try {
            const match = pattern.regex.exec(normalizedText);
            if (match) {
                if (DEBUG) console.log(`Found standard match for ${testName}: ${match[1]}`);
                
                // Look for reference range
                let refRange = null;
                const matchLine = lines.find(line => line.includes(match[1])) || '';
                const refRangeMatch = matchLine.match(/(\d+\.?\d*)\s*[-–]\s*(\d+\.?\d*)/);
                
                if (refRangeMatch) {
                    refRange = refRangeMatch[0];
                }
                
                results[testName] = {
                    value: parseFloat(match[1]).toFixed(2),
                    unit: pattern.standardUnit,
                    rawText: matchLine.trim(),
                    referenceRange: refRange,
                    confidence: 0.9,
                    matchType: 'standard'
                };
            }
        } catch (error) {
            console.error(`Error parsing ${testName} with standard pattern:`, error);
        }
    }
    
    // Fuzzy search through the text for common biomarker names and nearby numbers
    if (Object.keys(results).length === 0) {
        const commonBiomarkers = {
            'Testosterone': /(?:Testosterone|Test\.)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'HDL-C': /(?:HDL|HDL-C|HDL Cholesterol)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'LDL-C': /(?:LDL|LDL-C|LDL Cholesterol)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'Total Cholesterol': /(?:Total Cholesterol|Cholesterol, Total)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'Triglycerides': /(?:Triglycerides|TG)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'Glucose': /(?:Glucose|GLU)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'HbA1c': /(?:HbA1c|A1c|Hemoglobin A1c)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'TSH': /(?:TSH|Thyroid Stimulating Hormone)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'Free T4': /(?:Free T4|T4, Free|FT4)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'ALT': /(?:ALT|SGPT|Alanine Aminotransferase)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
            'AST': /(?:AST|SGOT|Aspartate Aminotransferase)\s*(?:[^\d]*?)\s*(\d+\.?\d*)/i,
        };
        
        for (const [biomarker, pattern] of Object.entries(commonBiomarkers)) {
            const match = pattern.exec(normalizedText);
            if (match && !isNaN(parseFloat(match[1]))) {
                if (DEBUG) console.log(`Found fuzzy match for ${biomarker}: ${match[1]}`);
                
                const value = parseFloat(match[1]);
                // Skip unreasonable values
                if (value > 10000) continue;
                
                const standardUnit = biomarker in labPatterns ? labPatterns[biomarker].standardUnit : '';
                
                results[biomarker] = {
                    value: value.toFixed(2),
                    unit: standardUnit,
                    rawText: match[0],
                    referenceRange: null,
                    confidence: 0.8,
                    matchType: 'fuzzy'
                };
            }
        }
    }
    
    // Try to find reference ranges for values that don't have them
    for (const [biomarker, data] of Object.entries(results)) {
        if (!data.referenceRange) {
            const rangePattern = new RegExp(
                `${biomarker}[^\\n]*?(\\d+\\.?\\d*\\s*[-–]\\s*\\d+\\.?\\d*)`, 'i'
            );
            const rangeMatch = normalizedText.match(rangePattern);
            if (rangeMatch) {
                results[biomarker].referenceRange = rangeMatch[1];
            }
        }
    }

    if (DEBUG) {
        console.log('EasyOCR parsed results:', {
            totalValues: Object.keys(results).length,
            foundTests: Object.keys(results)
        });
    }

    return results;
}

/**
 * Find biomarker match based on approximate name matching
 * @param {string} testName - The test name to match
 * @returns {string|null} - The matched biomarker name or null
 */
function findBiomarkerMatch(testName) {
    if (!testName) return null;
    
    // Normalize the test name
    const normalizedTestName = testName.toLowerCase().trim();
    
    // Direct matching (case-insensitive)
    for (const [biomarker, pattern] of Object.entries(labPatterns)) {
        if (biomarker.toLowerCase() === normalizedTestName) {
            return biomarker;
        }
        
        // Check alternate names
        if (pattern.alternateNames) {
            for (const altName of pattern.alternateNames) {
                if (altName.toLowerCase() === normalizedTestName) {
                    return biomarker;
                }
            }
        }
    }
    
    // Fuzzy matching - look for biomarker names that are substrings
    for (const [biomarker, pattern] of Object.entries(labPatterns)) {
        if (normalizedTestName.includes(biomarker.toLowerCase())) {
            return biomarker;
        }
        
        // Check if any alternate name is included
        if (pattern.alternateNames) {
            for (const altName of pattern.alternateNames) {
                if (normalizedTestName.includes(altName.toLowerCase())) {
                    return biomarker;
                }
                
                // Check if test name is included in the alternate name
                // (e.g., "TSH" would match "Thyroid Stimulating Hormone (TSH)")
                if (altName.toLowerCase().includes(normalizedTestName)) {
                    return biomarker;
                }
            }
        }
    }
    
    // No match found
    return null;
}

/**
 * Find the context around a match in the text
 * @param {string} text - The full text
 * @param {string} match - The matched substring
 * @returns {string} - The context around the match
 */
function findContextAroundMatch(text, match) {
    const index = text.indexOf(match);
    if (index === -1) return match;
    
    // Get up to 50 characters before and after the match
    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + match.length + 50);
    
    // Find line breaks to get the whole line(s)
    let contextStart = start;
    while (contextStart > 0 && text[contextStart - 1] !== '\n') {
        contextStart--;
    }
    
    let contextEnd = end;
    while (contextEnd < text.length && text[contextEnd] !== '\n') {
        contextEnd++;
    }
    
    return text.substring(contextStart, contextEnd);
}

/**
 * Extract test date from OCR text
 * @param {string} text - The OCR text
 * @returns {Date|null} The extracted date or null
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
                
                // Try various date formats
                // Format: YYYY-MM-DD or YYYY/MM/DD
                if (/^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/.test(dateStr)) {
                    return new Date(dateStr);
                }
                
                // Format: DD-MMM-YYYY or DD/MMM/YYYY
                const monthNameMatch = dateStr.match(/(\d{1,2})[-\/\s]([A-Za-z]{3})[-\/\s](\d{4})/);
                if (monthNameMatch) {
                    const day = parseInt(monthNameMatch[1]);
                    const monthStr = monthNameMatch[2];
                    const year = parseInt(monthNameMatch[3]);
                    
                    const monthMap = {
                        'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                        'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
                    };
                    
                    const month = monthMap[monthStr];
                    if (month !== undefined) {
                        return new Date(year, month, day);
                    }
                }
                
                // Format: MM/DD/YYYY or DD/MM/YYYY
                const slashMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
                if (slashMatch) {
                    // In US format - assuming MM/DD/YYYY
                    const month = parseInt(slashMatch[1]) - 1;
                    const day = parseInt(slashMatch[2]);
                    const year = parseInt(slashMatch[3]);
                    
                    return new Date(year, month, day);
                }
                
                // If all else fails, try direct Date parsing
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate;
                }
                
            } catch (error) {
                console.log(`Error parsing date: ${error}`);
            }
        }
    }
    
    // Try more generic date patterns if the standard ones fail
    const datePatterns = [
        /(\d{1,2}[-\/]\d{1,2}[-\/]\d{4})/,  // DD/MM/YYYY or MM/DD/YYYY
        /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})/,  // YYYY/MM/DD
        /([A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4})/,  // Month DD, YYYY
        /(\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4})/,  // DD Month YYYY
    ];
    
    for (const pattern of datePatterns) {
        const match = text.match(pattern);
        if (match) {
            try {
                const dateStr = match[1];
                const parsedDate = new Date(dateStr);
                if (!isNaN(parsedDate.getTime())) {
                    return parsedDate;
                }
            } catch (error) {
                // Ignore parsing errors and try next pattern
            }
        }
    }
    
    // Look for text like "Test Date: September 16, 2018"
    const textDateMatch = text.match(/(?:Test|Collection|Report|Sample)\s+Date:?\s+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
    if (textDateMatch) {
        try {
            const dateStr = textDateMatch[1];
            const parsedDate = new Date(dateStr);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate;
            }
        } catch (error) {
            // Ignore parsing errors
        }
    }
    
    return null;
}

/**
 * Main function to extract lab data from a file using EasyOCR via Python script
 * @param {string} filePath - Path to the file (PDF or image)
 * @returns {Promise<Object>} Extracted lab values and test date
 */
async function extractFromPDF(filePath) {
    try {
        // Create a temporary Python script to run EasyOCR
        const scriptPath = path.join(__dirname, 'run_easyocr.py');
        const scriptContent = `
import sys
import os
import json
import traceback

# Disable progress bar to avoid encoding issues
os.environ["EASYOCR_DISABLE_PROGRESS"] = "1"

try:
    # Try importing the required libraries
    import easyocr
    from PIL import Image
    
    # Function to handle PDFs
    def process_pdf(file_path):
        try:
            from pdf2image import convert_from_path
            # Convert PDF to images
            images = convert_from_path(file_path, dpi=300)
            all_text = ""
            
            # Process each page
            for i, img in enumerate(images):
                # Save temporarily
                img_path = os.path.join(os.path.dirname(file_path), f"temp_page_{i}.jpg")
                img.save(img_path)
                
                print(f"Processing page {i+1} of {len(images)}", file=sys.stderr)
                
                # Process with EasyOCR
                detection_result = reader.readtext(img_path)
                
                # Sort text by vertical position (top to bottom, left to right)
                detection_result.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
                
                # Group text into lines based on vertical position
                lines = []
                current_line = []
                current_y = None
                
                for box, text, conf in detection_result:
                    y_pos = (box[0][1] + box[2][1]) / 2  # Average Y position
                    
                    if current_y is None:
                        current_y = y_pos
                        
                    # If this text is significantly below the current line, start a new line
                    if abs(y_pos - current_y) > 20:  # Adjust threshold as needed
                        if current_line:
                            lines.append(' '.join(current_line))
                            current_line = []
                        current_y = y_pos
                    
                    current_line.append(text)
                
                # Add the last line
                if current_line:
                    lines.append(' '.join(current_line))
                
                # Join lines with newlines
                page_text = '\\n'.join(lines)
                all_text += f"\\n--- PAGE {i+1} ---\\n{page_text}\\n"
                
                # Clean up
                try:
                    os.remove(img_path)
                except:
                    pass
                    
            return all_text
        except Exception as e:
            return f"Error processing PDF: {str(e)}\\n{traceback.format_exc()}"
    
    # Initialize EasyOCR with silent download
    print("Initializing EasyOCR reader...", file=sys.stderr)
    reader = easyocr.Reader(['en'], verbose=False, download_enabled=True)
    
    # Get file path from command line argument
    file_path = sys.argv[1]
    print(f"Processing file: {file_path}", file=sys.stderr)
    
    # Determine file type and process accordingly
    if file_path.lower().endswith('.pdf'):
        text = process_pdf(file_path)
    else:
        # Process single image
        detection_result = reader.readtext(file_path)
        
        # Sort text by position
        detection_result.sort(key=lambda x: (x[0][0][1], x[0][0][0]))
        
        # Group text into lines
        lines = []
        current_line = []
        current_y = None
        
        for box, text, conf in detection_result:
            y_pos = (box[0][1] + box[2][1]) / 2
            
            if current_y is None:
                current_y = y_pos
                
            if abs(y_pos - current_y) > 20:
                if current_line:
                    lines.append(' '.join(current_line))
                    current_line = []
                current_y = y_pos
            
            current_line.append(text)
        
        if current_line:
            lines.append(' '.join(current_line))
        
        text = '\\n'.join(lines)
    
    # Output the extracted text as JSON
    output = {
        "text": text,
        "confidence": 0.9  # Simple confidence value
    }
    
    print(json.dumps(output))
    
except Exception as e:
    # Handle any errors
    error_output = {
        "error": str(e),
        "traceback": traceback.format_exc()
    }
    print(json.dumps(error_output), file=sys.stderr)
    sys.exit(1)
        `;

        // Write the script to file
        fs.writeFileSync(scriptPath, scriptContent);
        
        if (DEBUG) console.log(`Created temporary Python script at ${scriptPath}`);
        
        // Execute the Python script with proper error handling
        if (DEBUG) console.log(`Processing file: ${filePath}`);
        
        try {
            const output = execSync(`python "${scriptPath}" "${filePath}"`, {
                encoding: 'utf-8',
                maxBuffer: 10 * 1024 * 1024, // 10 MB buffer for large outputs
                windowsHide: true
            });
            
            // Parse the JSON output
            const result = JSON.parse(output);
            const { text, confidence } = result;
            
            if (DEBUG) console.log(`EasyOCR extracted ${text.length} characters of text`);
            if (DEBUG) console.log(`Sample extracted text: ${text.substring(0, 200)}...`);
            
            // Save full text to a debug file if in debug mode
            if (DEBUG) {
                const debugFilePath = path.join(path.dirname(filePath), 'debug_ocr_output.txt');
                fs.writeFileSync(debugFilePath, text);
                console.log(`Saved full OCR text to ${debugFilePath} for debugging`);
            }
            
            // Parse lab values and test date
            const labValues = parseLabValues(text);
            const testDate = extractTestDate(text);
            
            // Clean up the temporary script
            try {
                fs.unlinkSync(scriptPath);
            } catch (err) {
                console.log(`Warning: Failed to delete temporary script: ${err.message}`);
            }
            
            return {
                labValues,
                testDate
            };
        } catch (execError) {
            console.error('Python execution error:', execError.message);
            console.error('Error output:', execError.stderr);
            
            // Try to parse error JSON if available
            try {
                const errorJson = JSON.parse(execError.stderr);
                throw new Error(`EasyOCR error: ${errorJson.error}\n${errorJson.traceback}`);
            } catch (jsonError) {
                // If not JSON, throw the original error
                throw new Error(`Python execution failed: ${execError.message}`);
            }
        }
    } catch (error) {
        console.error('Error extracting from file with EasyOCR:', error);
        throw error;
    }
}

/**
 * Interpret OCR confidence level
 * @param {number} confidence - The OCR confidence value (0-1)
 * @returns {string} The confidence level description
 */
function interpretConfidence(confidence) {
    if (confidence >= 0.9) return 'high';
    if (confidence >= 0.75) return 'medium';
    return 'low';
}

module.exports = {
    extractFromPDF,
    parseLabValues,
    extractTestDate,
    interpretConfidence
};