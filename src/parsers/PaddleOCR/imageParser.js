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
    
    // Split text into lines and clean
    const lines = text.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
    
    console.log("Total lines:", lines.length);
    
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
        
        // Skip header and non-data lines
        if (line.match(/Test Name|Result|Units|Reference Range|Flag|Patient Name|Date of Birth|Collection Date|HEALTHLYNC|LABORATORY|Phone:|Address:|Practice:|Physician:|Medical License:|ABNORMAL VALUES|--- Page/i)) {
            continue;
        }
        
        // Parse potential lab data lines
        if (line.length > 10) {
            const parsed = parseLabDataLine(line, lines, i);
            if (parsed) {
                console.log(`Parsed: ${parsed.testName} = ${parsed.value} ${parsed.unit}`);
                
                // Map to standard name
                const standardName = mapToStandardBiomarker(parsed.testName);
                
                results[standardName] = {
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
    // Skip page separators and junk lines
    if (line.match(/^---\s*Page\s*\d+\s*---/i) || 
        line.match(/Phone:|Address:|Practice:|Physician:|Medical License:/i)) {
        return null;
    }
    
    console.log(`=== Parsing line ${lineIndex}: "${line}" ===`);
    
    // Enhanced patterns with better handling of special cases
    const patterns = [
        // Pattern 1: Standard format "Test Name Value Unit Range Flag"
        /^([A-Za-z\s,\-\(\)]{5,50}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]+(?:\/\w+)*)\s+([\d\.\s\-<>]+(?:\s*[\-–]\s*[\d\.]+)?)\s*(HIGH|LOW|NORMAL)?$/i,
        
        // Pattern 2: Format without flag
        /^([A-Za-z\s,\-\(\)]{5,50}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]+(?:\/\w+)*)\s+([\d\.\s\-<>]+(?:\s*[\-–]\s*[\d\.]+)?)$/i,
        
        // Pattern 3: Just test name, value, unit
        /^([A-Za-z\s,\-\(\)]{5,50}?)\s+([\d\.]+)\s+([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]+(?:\/\w+)*)$/i,
        
        // Pattern 4: Handle special cases like eGFR ">60" or missing units
        /^([A-Za-z\s,\-\(\)]{5,50}?)\s+([>]?[\d\.]+)\s*([a-zA-Z%\/μmLdKfluI\²³⁹⁰\-\/]*(?:\/\w+)*)\s*(.*)$/i,
        
        // Pattern 5: Handle cases where unit might be missing but range exists
        /^([A-Za-z\s,\-\(\)]{5,50}?)\s+([\d\.]+)\s+([\d\.\s\-<>]+(?:\s*[\-–]\s*[\d\.]+)?)\s*(HIGH|LOW|NORMAL)?$/i
    ];
    
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
        const pattern = patterns[patternIndex];
        const match = line.match(pattern);
        
        if (match) {
            console.log(`  Matched pattern ${patternIndex + 1}`);
            
            let testName = match[1].trim();
            let value = parseFloat(match[2].replace('>', ''));
            let unit = match[3] ? match[3].trim() : '';
            let referenceRange = match[4] ? match[4].trim() : null;
            let flag = match[5] || '';
            
            // Skip if value is not valid
            if (isNaN(value)) {
                console.log(`  Skipping - invalid value: ${match[2]}`);
                continue;
            }
            
            // Skip if test name is too short or invalid
            if (testName.length < 3 || /^[^a-zA-Z]*$/.test(testName)) {
                console.log(`  Skipping - invalid test name: "${testName}"`);
                continue;
            }
            
            // Handle special cases for missing units
            if (!unit || unit.length === 0) {
                // Try to infer unit from test name or look ahead
                unit = inferUnitFromTestName(testName) || lookAheadForUnit(allLines, lineIndex);
            }
            
            // Handle cases where unit got mixed with range (Pattern 5)
            if (patternIndex === 4 && unit && unit.match(/[\d\.\s\-<>]/)) {
                referenceRange = unit;
                unit = inferUnitFromTestName(testName) || '';
            }
            
            // Clean reference range
            if (referenceRange) {
                // Remove non-numeric characters except ranges
                referenceRange = referenceRange.replace(/[^\d\.\s\-<>]/g, '').trim();
                if (referenceRange.length < 2) referenceRange = null;
                
                // Handle flags that got mixed into range
                if (referenceRange && referenceRange.match(/HIGH|LOW|NORMAL/i)) {
                    const flagMatch = referenceRange.match(/(HIGH|LOW|NORMAL)/i);
                    if (flagMatch) flag = flagMatch[1];
                    referenceRange = referenceRange.replace(/HIGH|LOW|NORMAL/gi, '').trim();
                }
            }
            
            // Special handling for specific test types
            if (testName.match(/eGFR/i)) {
                unit = 'mL/min/1.73m²';
                if (match[2].includes('>')) {
                    referenceRange = '>60';
                }
            }
            
            // Fix specific test name issues
            if (testName.match(/Hematocrit/i) && unit.match(/LOW|HIGH|NORMAL/i)) {
                flag = unit;
                unit = '%';
            }
            
            console.log(`  SUCCESS: ${testName} = ${value} ${unit} (${referenceRange || 'no range'}) ${flag}`);
            
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

function inferUnitFromTestName(testName) {
    const unitMappings = {
        'Hemoglobin': 'g/dL',
        'Hematocrit': '%',
        'Glucose': 'mg/dL',
        'Cholesterol': 'mg/dL',
        'Triglycerides': 'mg/dL',
        'Creatinine': 'mg/dL',
        'Sodium': 'mmol/L',
        'Potassium': 'mmol/L',
        'Chloride': 'mmol/L',
        'TSH': 'mIU/L',
        'Free T4': 'ng/dL',
        'Vitamin D': 'ng/mL',
        'Vitamin B12': 'pg/mL',
        'Folate': 'ng/mL',
        'ESR': 'mm/hr',
        'CRP': 'mg/L',
        'eGFR': 'mL/min/1.73m²'
    };
    
    for (const [testPattern, unit] of Object.entries(unitMappings)) {
        if (testName.toLowerCase().includes(testPattern.toLowerCase())) {
            return unit;
        }
    }
    
    return null;
}

/**
 * Look ahead in lines to find missing unit
 */
function lookAheadForUnit(allLines, currentIndex) {
    // Check next 2 lines for isolated units
    for (let i = currentIndex + 1; i < Math.min(currentIndex + 3, allLines.length); i++) {
        const nextLine = allLines[i].trim();
        if (nextLine.match(/^[a-zA-Z%\/μmLdK]+$/)) {
            return nextLine;
        }
    }
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
    
    // Remove PaddleOCR warning messages first
    let cleaned = text
        .replace(/\[2025\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}\] ppocr WARNING:.*?\n/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\t/g, ' ');
    
    // Fix common OCR errors specific to medical lab reports
    const corrections = {
        'Test Narme': 'Test Name',
        'Sodiurm': 'Sodium',
        'MfuL': 'M/uL',
        'KfuL': 'K/uL', 
        'ngfmL': 'ng/mL',
        'ngfdL': 'ng/dL',
        "mm'hr": 'mm/hr',
        'mIU/L': 'mIU/L',
        'ALT{SGPT}': 'ALT (SGPT)',
        'AST(SGOT}': 'AST (SGOT)',
        'c200': '<200',
        'c100': '<100',
        'c130': '<130',
        'Hermoglobin': 'Hemoglobin',
        'Muttiple': 'Multiple',
        'indicales': 'indicates',
        'Elevaled': 'Elevated'
    };
    
    // Apply corrections
    for (const [wrong, correct] of Object.entries(corrections)) {
        const regex = new RegExp(escapeRegex(wrong), 'gi');
        cleaned = cleaned.replace(regex, correct);
    }
    
    return cleaned;
}

// Helper function to escape regex special characters
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        'HDL Cholesterol': 'HDL-C',      // Fixed mapping
        'LDL Cholesterol': 'LDL-C',
        'Non-HDL Cholesterol': 'Non-HDL-C',  // Added separate mapping
        'Triglycerides': 'Triglycerides',
        'Glucose': 'Glucose Random',
        'Blood Urea Nitrogen': 'BUN',
        'Creatinine': 'Creatinine',
        'Sodium': 'Sodium',
        'Sodiurm': 'Sodium',  // Handle OCR error
        'Potassium': 'Potassium',
        'Chloride': 'Chloride',
        'Carbon Dioxide': 'Bicarbonate',
        'Calcium': 'Calcium',
        'Total Protein': 'Total Protein',
        'Albumin': 'Albumin',
        'Total Bilirubin': 'Bilirubin',
        'Alkaline Phosphatase': 'ALP',
        'ALT (SGPT)': 'ALT',
        'AST (SGOT)': 'AST',
        'Free T4': 'T4 Free',
        'TSH': 'TSH',
        'eGFR': 'eGFR',
        'Vitamin D, 25-Hydroxy': 'Vitamin D',
        'Vitamin D,': 'Vitamin D',  // Handle parsing error
        'Vitamin B12': 'Vitamin B12',
        'Folate': 'Folate',
        'C-Reactive Protein, High Sensitivity': 'CRP',
        'Erythrocyte Sedimentation Rate': 'ESR'
    };
    
    // Direct mapping first
    if (mapping[testName]) {
        return mapping[testName];
    }
    
    // Partial matching for fuzzy matches
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
  mapToStandardBiomarker,
  inferUnitFromTestName
};