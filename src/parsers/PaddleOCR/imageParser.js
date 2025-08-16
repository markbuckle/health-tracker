// Enhanced medical lab parser for PaddleOCR

/**
 * UPDATED parseStructuredLabReport function with better table detection
 * @param {string} text - OCR text from the document
 * @returns {Object} Extracted lab values
 */
function parseStructuredLabReport(text) {
    const results = {};
    if (!text) return results;
    
    console.log("=== DEBUG: parseStructuredLabReport ===");
    console.log("Input text length:", text.length);
    console.log("First 300 chars:", text.substring(0, 300));
    
    // Split text into lines and clean
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    console.log("Total lines:", lines.length);
    console.log("First 10 lines:");
    lines.slice(0, 10).forEach((line, i) => {
        console.log(`  ${i + 1}: "${line}"`);
    });
    
    // Look for lab data patterns in each line
    let inDataSection = false;
    let currentSection = '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detect section headers
        if (line.match(/COMPLETE BLOOD COUNT|COMPREHENSIVE METABOLIC|LIPID PANEL|THYROID FUNCTION|VITAMIN LEVELS|INFLAMMATION MARKERS/i)) {
            currentSection = line;
            inDataSection = true;
            console.log(`Found section: ${currentSection}`);
            continue;
        }
        
        // Skip header lines
        if (line.match(/Test Name|Result|Units|Reference Range|Flag|Patient Name|Date of Birth|Collection Date|HEALTHLYNC|LABORATORY/i)) {
            continue;
        }
        
        // Look for potential lab data lines
        // Pattern: contains a test name, a number, and possibly units
        if (line.length > 10) {
            const parsed = parseLabDataLine(line, lines, i);
            if (parsed) {
                console.log(`Parsed: ${parsed.testName} = ${parsed.value} ${parsed.unit}`);
                results[parsed.testName] = {
                    value: parsed.value,
                    unit: parsed.unit,
                    rawText: line,
                    referenceRange: parsed.referenceRange,
                    confidence: parsed.confidence,
                    flag: parsed.flag,
                    section: currentSection
                };
            }
        }
    }
    
    console.log(`Structured parsing found ${Object.keys(results).length} lab values`);
    return results;
}

// New helper function to parse individual lab data lines
function parseLabDataLine(line, allLines, lineIndex) {
    // Debug this specific line
    console.log(`=== Parsing line ${lineIndex}: "${line}" ===`);
    
    // Multiple patterns for different formats we might encounter
    const patterns = [
        // Pattern 1: "Test Name Result Unit Range Flag"
        // Example: "Hemoglobin 10.8 g/dL 12.0 - 15.0 LOW"
        /^([A-Za-z\s,\-\(\)]{5,40}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]+)\s+([\d\.\s\-<>]+(?:\s*[\-–]\s*[\d\.]+)?)\s*(HIGH|LOW|NORMAL)?$/i,
        
        // Pattern 2: "Test Name Result Unit Range" (no flag)
        /^([A-Za-z\s,\-\(\)]{5,40}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]+)\s+([\d\.\s\-<>]+(?:\s*[\-–]\s*[\d\.]+)?)$/i,
        
        // Pattern 3: "Test Name Result Unit" (range might be elsewhere)
        /^([A-Za-z\s,\-\(\)]{5,40}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]+)$/i,
        
        // Pattern 4: Handle special cases like eGFR ">60"
        /^([A-Za-z\s,\-\(\)]{5,40}?)\s+([>]?[\d\.]+)\s+([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]+)(.*)$/i,
        
        // Pattern 5: More flexible - just test name and number
        /^([A-Za-z\s,\-\(\)]{5,40}?)\s+([\d\.]+)(.*)$/i
    ];
    
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
        const pattern = patterns[patternIndex];
        const match = line.match(pattern);
        
        if (match) {
            console.log(`  Matched pattern ${patternIndex + 1}`);
            console.log(`  Groups: [${match.slice(1).join(', ')}]`);
            
            const testName = match[1].trim();
            let value = parseFloat(match[2].replace('>', ''));
            let unit = match[3] ? match[3].trim() : '';
            let referenceRange = match[4] ? match[4].trim() : null;
            let flag = match[5] || '';
            
            // Skip if value is not valid
            if (isNaN(value)) {
                console.log(`  Skipping - invalid value: ${match[2]}`);
                continue;
            }
            
            // Skip if test name is too short or looks like junk
            if (testName.length < 3 || /^[^a-zA-Z]*$/.test(testName)) {
                console.log(`  Skipping - invalid test name: "${testName}"`);
                continue;
            }
            
            // Clean up unit (remove obvious junk)
            if (unit && (unit.length > 15 || /[^a-zA-Z0-9%\/μmLdKfluI\²³⁹⁰\-\/]/.test(unit))) {
                console.log(`  Cleaning unit: "${unit}" -> extracting from match`);
                // Try to extract just the unit part
                const unitMatch = unit.match(/([a-zA-Z%\/μmLdK]+)/);
                unit = unitMatch ? unitMatch[1] : '';
            }
            
            // Clean reference range
            if (referenceRange) {
                referenceRange = referenceRange.replace(/[^\d\.\s\-<>]/g, '').trim();
                if (referenceRange.length < 3) referenceRange = null;
            }
            
            console.log(`  SUCCESS: ${testName} = ${value} ${unit} (${referenceRange || 'no range'})`);
            
            return {
                testName: testName,
                value: value,
                unit: unit,
                referenceRange: referenceRange,
                flag: flag,
                confidence: 0.9
            };
        }
    }
    
    console.log(`  No patterns matched for: "${line}"`);
    return null;
}

// Helper function to clean test names
function cleanTestName(name) {
    return name.trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\-\(\),]/g, '')
        .trim();
}

// Enhanced reference range cleaning
function cleanReferenceRange(range) {
    if (!range) return null;
    
    return range.trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\d\.\s\-<>]/g, '')
        .trim();
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
 * Basic OCR cleanup without any test-specific logic
 * @param {string} text - Raw OCR text
 * @returns {string} Cleaned text
 */
function preprocessOCRText(text) {
    if (!text) return '';
    
    console.log("=== DEBUG: preprocessOCRText INPUT ===");
    console.log("Input length:", text.length);
    console.log("First 200 chars:", text.substring(0, 200));
    
    // Basic cleaning only - DO NOT use aggressive regex replacements
    let cleaned = text
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ');
        // Remove the .replace(/\s+/g, ' ') that was collapsing everything
    
    // Only fix VERY specific OCR errors, one at a time
    const corrections = {
        'Hemogiobin': 'Hemoglobin',
        'Hematocnt': 'Hematocrit', 
        'Test Narme': 'Test Name',  // Fix the OCR error we saw
        'Muttiple': 'Multiple',
        'indicales': 'indicates',
        'Elevaled': 'Elevated',
        'Madical': 'Medical',
        'Licans8': 'License'
    };
    
    // Apply corrections carefully
    for (const [wrong, correct] of Object.entries(corrections)) {
        // Use word boundaries to avoid corrupting other text
        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
        cleaned = cleaned.replace(regex, correct);
    }
    
    console.log("=== DEBUG: preprocessOCRText OUTPUT ===");
    console.log("Output length:", cleaned.length);
    console.log("First 200 chars:", cleaned.substring(0, 200));
    
    return cleaned;
}

// Helper function to map test names to standard biomarker names
function mapToStandardBiomarker(testName) {
    const mapping = {
        'Hemoglobin': 'Hgb',
        'Hematocrit': 'Hct',
        'Mean Corpuscular Volume': 'MCV',
        'Mean Corpuscular Hemoglobin': 'MCH',
        'Platelet Count': 'PLT',
        'White Blood Cell Count': 'WBC',
        'Red Blood Cell Count': 'RBC',
        'Total Cholesterol': 'Total Cholesterol',
        'HDL Cholesterol': 'HDL-C',
        'LDL Cholesterol': 'LDL-C',
        'Triglycerides': 'Triglycerides',
        'Glucose': 'Glucose Random',
        'Blood Urea Nitrogen': 'BUN',
        'Creatinine': 'Creatinine',
        'Sodium': 'Sodium',
        'Potassium': 'Potassium',
        'Chloride': 'Chloride',
        'Carbon Dioxide': 'Bicarbonate',
        'Calcium': 'Calcium',
        'Total Protein': 'Total Protein',
        'Albumin': 'Albumin',
        'Total Bilirubin': 'Bilirubin',
        'Alkaline Phosphatase': 'ALP',
        'Free T4': 'T4 Free',
        'TSH': 'TSH',
        'Vitamin D, 25-Hydroxy': 'Vitamin D',
        'Vitamin B12': 'Vitamin B12',
        'Folate': 'Folate',
        'C-Reactive Protein, High Sensitivity': 'CRP',
        'Erythrocyte Sedimentation Rate': 'ESR'
    };
    
    // Direct mapping
    if (mapping[testName]) {
        return mapping[testName];
    }
    
    // Partial matching
    for (const [fullName, shortName] of Object.entries(mapping)) {
        if (testName.toLowerCase().includes(fullName.toLowerCase()) || 
            fullName.toLowerCase().includes(testName.toLowerCase())) {
            return shortName;
        }
    }
    
    // Return original name if no mapping found
    return testName;
}

// Export all functions
module.exports = {
  parseStructuredLabReport,
  parseLabDataLine,
  cleanTestName,
  cleanReferenceRange,
  normalizeTestName,
  extractStructuredDate,
  preprocessOCRText,
  mapToStandardBiomarker
};