// Enhanced medical lab parser for PaddleOCR

/**
 * This function adds specific patterns to better recognize lab test results
 * in structured medical lab reports with headers like TEST NAME, RESULT, FLAG, etc.
 * @param {string} text - OCR text from the document
 * @returns {Object} Extracted lab values
 */
function parseStructuredLabReport(text) {
    const results = {};
    if (!text) return results;
    
    // Look for common lab report table formats
    const tablePatterns = [
      // Pattern 1: "TEST NAME    RESULT    FLAG    REFERENCE    UNITS"
      /TEST\s*NAME.*?RESULT.*?(?:FLAG)?.*?REFERENCE.*?UNITS/i,
      // Pattern 2: Header row with these words in any order
      /(?=.*TEST)(?=.*RESULT)(?=.*REFERENCE)/i
    ];
    
    // Check if text contains a table structure
    const hasTableStructure = tablePatterns.some(pattern => pattern.test(text));
    
    if (hasTableStructure) {
      console.log("Found structured lab report table");
      
      // Split text into lines
      const lines = text.split('\n');
      
      // Find the header line for column identification
      let headerIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (/TEST\s*NAME|RESULT|REFERENCE|UNITS/i.test(lines[i])) {
          headerIndex = i;
          break;
        }
      }
      
      if (headerIndex >= 0) {
        const headerLine = lines[headerIndex].toLowerCase();
        
        // Determine column positions based on header
        const columns = {
          testName: headerLine.indexOf('test name') !== -1 ? headerLine.indexOf('test name') : headerLine.indexOf('test'),
          result: headerLine.indexOf('result'),
          reference: headerLine.indexOf('reference'),
          units: headerLine.indexOf('units')
        };
        
        // Process lines after the header
        for (let i = headerIndex + 1; i < lines.length; i++) {
          const line = lines[i];
          
          // Skip empty lines and lines that look like headers or footers
          if (!line.trim() || /page|date:|patient|performing/i.test(line)) continue;
          
          // Extract test name - might span multiple words
          let testName = '';
          let resultValue = '';
          let referenceRange = '';
          let units = '';
          
          // Extract test name (common medical test names)
          const testNamePatterns = [
            // Specific test name patterns
            /\b(C\s*REACTIVE\s*PROTEIN\s*(?:HIGH\s*SENS)?)\b/i,
            /\b(THYROPEROXIDASE\s*ANTIBODY)\b/i,
            /\b(TSH)\b/i,
            /\b(T3|T4|FREE\s*T4|FREE\s*T3)\b/i,
            /\b(THYROID\s*STIMULATING\s*HORMONE)\b/i,
            // Generic pattern for any text that might be a test name at the beginning of line
            /^([A-Z][A-Za-z\s\-]+)(?=\s+[\d<>.])/
          ];
          
          // Try to match test name patterns
          for (const pattern of testNamePatterns) {
            const match = line.match(pattern);
            if (match) {
              testName = match[1].trim();
              break;
            }
          }
          
          // If no test name found, try extracting from position
          if (!testName && columns.testName >= 0) {
            // Find where the result or next column might start
            const nextColStart = Object.values(columns)
              .filter(pos => pos > columns.testName && pos !== -1)
              .sort((a, b) => a - b)[0] || line.length;
            
            testName = line.substring(columns.testName, nextColStart).trim();
          }
          
          // Only proceed if we have a test name
          if (testName) {
            // Extract result value - find a number pattern
            const resultPattern = /(\d+\.?\d*|\<\s*\d+\.?\d*)/;
            const resultMatch = line.match(resultPattern);
            if (resultMatch) {
              resultValue = resultMatch[1].replace('<', '').trim();
            }
            
            // Extract reference range - look for a pattern like "0-6" or "0.5-2.0"
            const rangePattern = /(\d+\.?\d*\s*[\-–]\s*\d+\.?\d*)/;
            const rangeMatch = line.match(rangePattern);
            if (rangeMatch) {
              referenceRange = rangeMatch[1].trim();
            }
            
            // Extract units - common units at the end of line
            const unitsPattern = /(mg\/L|kIU\/L|nmol\/L|pmol\/L|U\/L|mmol\/L)$/;
            const unitsMatch = line.match(unitsPattern);
            if (unitsMatch) {
              units = unitsMatch[1];
            }
            
            // If we have a test name and result, add to results
            if (testName && resultValue) {
              // Normalize test name
              const normalizedName = normalizeTestName(testName);
              
              results[normalizedName] = {
                value: parseFloat(resultValue),
                unit: units,
                rawText: line.trim(),
                referenceRange: referenceRange,
                confidence: 0.9 // Higher confidence for structured format
              };
              
              console.log(`Found structured format match: ${normalizedName} = ${resultValue} ${units} (${referenceRange})`);
            }
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * Normalize test names to standard format
   * @param {string} testName - The detected test name
   * @returns {string} - Standardized test name
   */
  function normalizeTestName(testName) {
    testName = testName.trim();
    
    // Mapping of common variations to standard names
    const nameMap = {
      // TSH variations
      'TSH': 'TSH',
      'THYROID STIMULATING HORMONE': 'TSH',
      
      // Thyroid antibody variations
      'THYROPEROXIDASE ANTIBODY': 'Anti-TPO',
      'TPO ANTIBODY': 'Anti-TPO',
      'THYROID PEROXIDASE': 'Anti-TPO',
      
      // CRP variations
      'C REACTIVE PROTEIN': 'C-Reactive Protein',
      'C REACTIVE PROTEIN HIGH SENS': 'hsCRP',
      'CRP': 'C-Reactive Protein',
      'HIGH SENSITIVITY CRP': 'hsCRP',
      
      // T3/T4 variations
      'FREE T4': 'T4 Free',
      'FREE T3': 'Free T3',
      'T4': 'T4 Total',
      'T3': 'T3 Total'
    };
    
    // Replace spaces and hyphens for consistency in comparison
    const normalized = testName.toUpperCase().replace(/[-\s]+/g, ' ');
    
    // Return mapped name or original if no mapping exists
    return nameMap[normalized] || testName;
  }
  
  /**
   * Extract test date from structured lab report
   * @param {string} text - OCR text
   * @returns {Date|null} - Extracted date
   */
  function extractStructuredDate(text) {
    if (!text) return null;
    
    // Common date patterns in lab reports
    const datePatterns = [
      // Pattern for "Collected Date: 08-Jan-2019 07:28:00"
      /Collected\s*Date:?\s*(\d{1,2}-[A-Za-z]{3}-\d{4})/i,
      
      // Pattern for mm/dd/yyyy or dd/mm/yyyy
      /(?:Collected|Collection|Received|Date)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      
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
  
  // Export the new functions to use in labParser.js
  module.exports = {
    parseStructuredLabReport,
    normalizeTestName,
    extractStructuredDate
  };