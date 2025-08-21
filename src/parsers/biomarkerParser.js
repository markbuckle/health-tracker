// src/parsers/biomarkerParser.js - SIMPLE FIX
// Go back to what was working, just remove false positives

/**
 * Universal biomarker parser - simplified approach
 * @param {string} ocrText - Raw OCR text from any provider
 * @returns {Object} Extracted biomarkers with values, units, and reference ranges
 */
function parseUniversalBiomarkers(ocrText) {
  console.log('🧬 Universal Biomarker Parser: Starting analysis...');
  
  if (!ocrText || ocrText.length === 0) {
    console.log('Universal Parser: No text provided');
    return {};
  }
  
  // Use the smart router fallback patterns that were working perfectly
  const results = parseBasicPatternsEnhanced(ocrText);
  
  // Add any missing biomarkers with additional patterns
  const additionalResults = parseAdditionalBiomarkers(ocrText);
  Object.assign(results, additionalResults);
  
  // Clean up obvious false positives
  const cleanedResults = cleanupResults(results, ocrText);
  
  const totalFound = Object.keys(cleanedResults).length;
  console.log(`🧬 Universal Parser: Found ${totalFound} biomarkers total`);
  
  if (totalFound > 0) {
    console.log('Universal Parser: Biomarkers found:', Object.keys(cleanedResults));
  }
  
  return cleanedResults;
}

/**
 * Enhanced version of the basic patterns that were working
 */
function parseBasicPatternsEnhanced(text) {
  console.log('Universal Parser: Using enhanced basic patterns...');
  
  const results = {};
  
  // These patterns were working perfectly - keep them exactly the same
  const biomarkerPatterns = {
    'Hemoglobin': {
      regex: /(?:Hemoglobin|Hgb)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'g/dL'
    },
    'Hematocrit': {
      regex: /(?:Hematocrit|Hct)\s*:?\s*(\d+\.?\d*)/i,
      unit: '%'
    },
    'Glucose': {
      regex: /(?:Glucose|GLU)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Total Cholesterol': {
      regex: /(?:Total Cholesterol|CHOL)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'HDL Cholesterol': {
      regex: /(?:HDL|HDL Cholesterol)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'LDL Cholesterol': {
      regex: /(?:LDL|LDL Cholesterol)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Triglycerides': {
      regex: /(?:Triglycerides|TRIG)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Creatinine': {
      regex: /(?:Creatinine|CREA)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'BUN': {
      regex: /(?:BUN|Blood Urea Nitrogen)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Sodium': {
      regex: /(?:Sodium|NA)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Potassium': {
      regex: /(?:Potassium|K)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Chloride': {
      regex: /(?:Chloride|CL)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Albumin': {
      regex: /(?:Albumin|ALB)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'g/dL'
    },
    'Total Bilirubin': {
      regex: /(?:Total Bilirubin|Bilirubin)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'ALT': {
      regex: /(?:ALT|SGPT|Alanine Aminotransferase)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'U/L'
    },
    'AST': {
      regex: /(?:AST|SGOT|Aspartate Aminotransferase)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'U/L'
    },
    'Alkaline Phosphatase': {
      regex: /(?:Alkaline Phosphatase|ALP)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'U/L'
    },
    'TSH': {
      regex: /(?:TSH|Thyroid Stimulating Hormone)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mIU/L'
    },
    'Free T4': {
      regex: /(?:Free T4|FT4)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'ng/dL'
    },
    'Vitamin D': {
      regex: /(?:Vitamin D|25-Hydroxy)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'ng/mL'
    },
    'Vitamin B12': {
      regex: /(?:Vitamin B12|B12)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'pg/mL'
    },
    'C-Reactive Protein': {
      regex: /(?:C-Reactive Protein|CRP)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/L'
    }
  };
  
  // Normalize text for better matching
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  console.log(`Universal Parser: Searching for biomarkers in ${normalizedText.length} character text`);
  
  // Try to match each biomarker pattern
  let matchCount = 0;
  for (const [biomarkerName, pattern] of Object.entries(biomarkerPatterns)) {
    try {
      const match = pattern.regex.exec(normalizedText);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          console.log(`Universal Parser: Found ${biomarkerName} = ${value} ${pattern.unit}`);
          
          results[biomarkerName] = {
            value: value,
            unit: pattern.unit,
            rawText: match[0].trim(),
            referenceRange: null,
            confidence: 0.8,
            source: 'enhanced-basic'
          };
          matchCount++;
        }
      }
    } catch (error) {
      console.error(`Universal Parser: Error parsing ${biomarkerName}:`, error.message);
    }
  }
  
  console.log(`Universal Parser: Found ${matchCount} biomarkers using enhanced basic patterns`);
  return results;
}

/**
 * Parse additional biomarkers with specific patterns
 */
function parseAdditionalBiomarkers(text) {
  const results = {};
  
  // Additional patterns for biomarkers we're missing
  const additionalPatterns = {
    'eGFR': {
      regex: /eGFR\s+(>?\d+\.?\d*)\s+mL\/min/im,
      unit: 'mL/min/1.73m²'
    },
    'Non-HDL Cholesterol': {
      regex: /Non-HDL Cholesterol\s+(\d+\.?\d*)\s+mg\/dL/im,
      unit: 'mg/dL'
    },
    'Folate': {
      regex: /Folate\s+(\d+\.?\d*)\s+ng\/mL/im,
      unit: 'ng/mL'
    }
  };
  
  let enhancedCount = 0;
  
  for (const [biomarkerName, pattern] of Object.entries(additionalPatterns)) {
    try {
      const match = pattern.regex.exec(text);
      if (match && match[1]) {
        const value = parseFloat(match[1].replace('>', ''));
        if (!isNaN(value)) {
          console.log(`Additional Match: ${biomarkerName} = ${value} ${pattern.unit}`);
          results[biomarkerName] = {
            value: value,
            unit: pattern.unit,
            rawText: match[0].trim(),
            referenceRange: null,
            confidence: 0.85,
            source: 'additional'
          };
          enhancedCount++;
        }
      }
    } catch (error) {
      console.error(`Error parsing additional ${biomarkerName}:`, error.message);
    }
  }
  
  console.log(`Universal Parser: Found ${enhancedCount} additional biomarkers`);
  return results;
}

/**
 * Clean up results - remove obvious false positives
 */
function cleanupResults(results, originalText) {
  const cleaned = {};
  
  // Remove biomarkers that are clearly false positives
  const falsePositivePatterns = [
    'Free Testosterone', 'Selenium', 'Arsenic', 'Lead', 'Mercury', 'Cadmium', 'Aluminum'
  ];
  
  for (const [name, data] of Object.entries(results)) {
    // Skip obvious false positives
    if (falsePositivePatterns.includes(name)) {
      console.log(`Universal Parser: Removing false positive: ${name}`);
      continue;
    }
    
    // Keep this biomarker
    cleaned[name] = data;
  }
  
  return cleaned;
}

/**
 * Extract test date from OCR text
 */
function extractUniversalTestDate(text) {
  if (!text) return new Date();
  
  const datePatterns = [
    /Collection Date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Report Date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /Date:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          console.log(`Universal Parser: Found test date: ${parsedDate.toDateString()}`);
          return parsedDate;
        }
      } catch (error) {
        console.error('Date parsing error:', error.message);
      }
    }
  }
  
  return new Date();
}

module.exports = {
  parseUniversalBiomarkers,
  extractUniversalTestDate
};