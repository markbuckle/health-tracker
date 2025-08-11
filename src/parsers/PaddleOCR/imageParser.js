// Enhanced medical lab parser for PaddleOCR

/**
 * UPDATED parseStructuredLabReport function with better table detection
 * @param {string} text - OCR text from the document
 * @returns {Object} Extracted lab values
 */
function parseStructuredLabReport(text) {
    const results = {};
    if (!text) return results;
    
    // IMPROVED: More flexible table detection patterns
    const tablePatterns = [
      // Your original patterns (keep these)
      /TEST\s*NAME.*?RESULT.*?(?:FLAG)?.*?REFERENCE.*?UNITS/i,
      /(?=.*TEST)(?=.*RESULT)(?=.*REFERENCE)/i,
      
      // ADD: More flexible patterns for different lab formats
      /Test\s+Name.*Result.*Units.*Reference\s+Range/i,
      /Result.*Units.*Reference\s+Range.*Flag/i,
      // Generic pattern: if we see test names with numeric values and units
      /(?=.*[A-Za-z]{5,})(?=.*\d+\.\d+)(?=.*(?:mg\/dL|g\/dL|%|K\/uL))/i
    ];
    
    // Check if text contains a table structure
    const hasTableStructure = tablePatterns.some(pattern => pattern.test(text));
    
    if (!hasTableStructure) {
      console.log("No table structure detected");
      return results;
    }
    
    console.log("Table structure detected");
    
    // Split text into lines
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip header lines and non-data lines
      if (/Test\s+Name|Result|Units|Reference|Flag|Page|Patient|Date|Collection|HEALTHLYNC|LABORATORY/i.test(line)) continue;
      if (line.length < 10) continue;
      
      // IMPROVED: More flexible pattern that works with various lab formats
      // Pattern: TestName + Number + Unit + ReferenceRange + OptionalFlag
      const labDataPatterns = [
        // Pattern 1: Full structured format with all fields
        /^([A-Za-z\s,\-()]+?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdKfluI]+)\s+([\d\.\s\-<>]+(?:\s*\-\s*[\d\.]+)?)\s*(?:(HIGH|LOW|NORMAL))?/,
        
        // Pattern 2: Simplified format (TestName Value Unit Range)
        /^([A-Za-z\s,\-()]{3,}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdK]{1,10})\s+([\d\.\s\-<>]{3,})/,
        
        // Pattern 3: Even simpler (TestName Value Unit) - extract range separately
        /^([A-Za-z\s,\-()]{3,}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdK]{1,10})/
      ];
      
      let matched = false;
      
      for (const pattern of labDataPatterns) {
        const match = line.match(pattern);
        if (match && !isNaN(parseFloat(match[2]))) {
          const testName = match[1].trim();
          const value = parseFloat(match[2]);
          const unit = match[3].trim();
          const refRange = match[4] ? match[4].trim() : null;
          const flag = match[5] || '';
          
          // Use the test name as-is, let your existing biomarker matching handle it
          if (testName.length >= 3 && value > 0) {
            console.log(`Structured parsing found: ${testName} = ${value} ${unit} (${refRange || 'no range'})`);
            
            results[testName] = {
              value: value,
              unit: unit,  // Keep original unit - no standardization
              rawText: line,
              referenceRange: refRange ? cleanReferenceRange(refRange) : null,
              confidence: 0.9,
              flag: flag,
              extractionMethod: 'structured'
            };
            
            matched = true;
            break;
          }
        }
      }
      
      // If no pattern matched, try to extract reference range from nearby lines
      if (!matched && /\d+\.\d+/.test(line)) {
        // Look for loose numeric patterns that might be biomarkers
        const loosePattern = /([A-Za-z\s,\-()]{3,})\s+([\d\.]+)/;
        const looseMatch = line.match(loosePattern);
        
        if (looseMatch) {
          const testName = looseMatch[1].trim();
          const value = parseFloat(looseMatch[2]);
          
          // Look ahead for unit and reference range in next lines
          let unit = '';
          let refRange = null;
          
          for (let j = i; j < Math.min(i + 3, lines.length); j++) {
            const nextLine = lines[j];
            // Look for units
            const unitMatch = nextLine.match(/\b([a-zA-Z%\/μmLdKfluI]{1,10})\b/);
            if (unitMatch && !unit) {
              unit = unitMatch[1];
            }
            // Look for reference ranges
            const rangeMatch = nextLine.match(/([\d\.]+\s*[\-–]\s*[\d\.]+|[<>]\s*[\d\.]+)/);
            if (rangeMatch && !refRange) {
              refRange = rangeMatch[1];
            }
          }
          
          if (testName.length >= 3 && value > 0) {
            console.log(`Loose parsing found: ${testName} = ${value} ${unit} (${refRange || 'no range'})`);
            
            results[testName] = {
              value: value,
              unit: unit || 'unknown',
              rawText: line,
              referenceRange: refRange ? cleanReferenceRange(refRange) : null,
              confidence: 0.7,
              flag: '',
              extractionMethod: 'loose'
            };
          }
        }
      }
    }
    
    return results;
}

/**
 * Normalize test names for better matching
 * @param {string} testName - Raw test name from OCR
 * @returns {string} Normalized test name
 */
function normalizeTestName(testName) {
    return testName
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Extract test date from structured lab report format
 * @param {string} text - OCR text
 * @returns {Date|null} Extracted test date
 */
function extractStructuredDate(text) {
    if (!text) return null;
    
    // Common date patterns in structured lab reports
    const datePatterns = [
      // Pattern for "Collection Date: MM/DD/YYYY"
      /(?:Collection|Test|Sample|Drawn|Report|Generated|Collected|Received|Date)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      
      // Pattern for dates like "08-Jan-2019"
      /(\d{1,2}-[A-Za-z]{3}-\d{4})/i,
      
      // Pattern for ISO format dates
      /(\d{4}-\d{2}-\d{2})/
    ];
    
    for (const pattern of datePatterns) {
      const match = text.match(pattern);
      if (match) {
        const dateStr = match[1];
        console.log("Found date string:", dateStr);
        
        try {
          // Handle date format with text month (08-Jan-2019)
          if (dateStr.includes('-') && /[A-Za-z]/.test(dateStr)) {
            const [day, month, year] = dateStr.split('-');
            const monthMap = {
              'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
              'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
            };
            
            const monthIndex = monthMap[month.toLowerCase()];
            if (monthIndex !== undefined) {
              const date = new Date(parseInt(year), monthIndex, parseInt(day));
              if (!isNaN(date.getTime())) {
                console.log(`Parsed date: ${date.toISOString()}`);
                return date;
              }
            }
          }
          
          // Try standard date parsing as fallback
          const date = new Date(dateStr);
          if (!isNaN(date.getTime())) {
            console.log(`Parsed date using standard parsing: ${date.toISOString()}`);
            return date;
          }
        } catch (error) {
          console.log(`Error parsing date '${dateStr}':`, error);
        }
      }
    }
    
    return null;
}

/**
 * Clean and standardize reference ranges
 * @param {string} refRange - Raw reference range from OCR
 * @returns {string} Cleaned reference range
 */
function cleanReferenceRange(refRange) {
  if (!refRange) return null;
  
  // Only basic cleaning - remove OCR artifacts
  return refRange
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/([0-9])\s*[\-–]\s*([0-9])/, '$1 - $2')  // Standardize range format
    .replace(/[^\d\.\s\-<>]/g, '')  // Remove non-numeric/range characters
    .trim();
}

/**
 * Basic OCR cleanup without any test-specific logic
 * @param {string} text - Raw OCR text
 * @returns {string} Cleaned text
 */
function preprocessOCRText(text) {
  if (!text) return '';
  
  return text
    // Fix only obvious OCR errors that affect parsing
    .replace(/\s{2,}/g, ' ')           // Normalize multiple spaces to single space
    .replace(/\t/g, ' ')               // Convert tabs to spaces
    .replace(/([a-z])(\d)/g, '$1 $2')  // Add space between letters and numbers where missing
    .replace(/(\d)([a-z])/gi, '$1 $2') // Add space between numbers and letters where missing
    .trim();
}

// Export all functions
module.exports = {
  parseStructuredLabReport,
  normalizeTestName,
  extractStructuredDate,
  cleanReferenceRange,
  preprocessOCRText
};