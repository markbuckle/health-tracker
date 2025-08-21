// src/parsers/biomarkerParser.js - COMPLETE FIX WITH REFERENCE RANGES
// Fixes missing biomarkers and adds reference range extraction

/**
 * Universal biomarker parser - improved patterns with reference ranges
 * @param {string} ocrText - Raw OCR text from any provider
 * @returns {Object} Extracted biomarkers with values, units, and reference ranges
 */
function parseUniversalBiomarkers(ocrText) {
  console.log('🧬 Universal Biomarker Parser: Starting analysis...');
  
  if (!ocrText || ocrText.length === 0) {
    console.log('Universal Parser: No text provided');
    return {};
  }
  
  // Use enhanced patterns that handle your specific lab format
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
 * Enhanced patterns with reference range extraction
 */
function parseBasicPatternsEnhanced(text) {
  console.log('Universal Parser: Using enhanced basic patterns...');
  
  const results = {};
  
  // Enhanced patterns that capture both tabular and colon formats
  const biomarkerPatterns = {
    'Hemoglobin': {
      regex: /(?:Hemoglobin|Hgb)\s+(\d+\.?\d*)\s+g\/dL\s+([\d\.\s\-<>]+)|(?:Hemoglobin|Hgb)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'g/dL'
    },
    'Hematocrit': {
      regex: /(?:Hematocrit|Hct)\s+(\d+\.?\d*)\s+%\s+([\d\.\s\-<>]+)|(?:Hematocrit|Hct)\s*:?\s*(\d+\.?\d*)/i,
      unit: '%'
    },
    // FIXED: Multiple Glucose patterns to catch all variations
    'Glucose': {
      regex: /(?:Glucose)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:Glucose)\s+(\d+\.?\d*)\s+mg\/dL|(?:Glucose|GLU)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Total Cholesterol': {
      regex: /(?:Total Cholesterol)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:Total Cholesterol|CHOL)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'HDL Cholesterol': {
      regex: /(?:HDL Cholesterol)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:HDL Cholesterol)\s+(\d+\.?\d*)\s+mg\/dL|(?:HDL|HDL Cholesterol)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'LDL Cholesterol': {
      regex: /(?:LDL Cholesterol)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:LDL|LDL Cholesterol)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Triglycerides': {
      regex: /(?:Triglycerides)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:Triglycerides|TRIG)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Creatinine': {
      regex: /(?:Creatinine)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:Creatinine|CREA)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'BUN': {
      regex: /(?:BUN|Blood Urea Nitrogen)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:BUN|Blood Urea Nitrogen)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Sodium': {
      regex: /(?:Sodium)\s+(\d+\.?\d*)\s+(?:mmol\/L|mEq\/L)\s+([\d\.\s\-<>]+)|(?:Sodium|NA)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Potassium': {
      regex: /(?:Potassium)\s+(\d+\.?\d*)\s+(?:mmol\/L|mEq\/L)\s+([\d\.\s\-<>]+)|(?:Potassium|K)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Chloride': {
      regex: /(?:Chloride)\s+(\d+\.?\d*)\s+(?:mmol\/L|mEq\/L)\s+([\d\.\s\-<>]+)|(?:Chloride|CL)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mEq/L'
    },
    'Albumin': {
      regex: /(?:Albumin)\s+(\d+\.?\d*)\s+g\/dL\s+([\d\.\s\-<>]+)|(?:Albumin|ALB)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'g/dL'
    },
    'Total Bilirubin': {
      regex: /(?:Total Bilirubin)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:Total Bilirubin|Bilirubin)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    // FIXED: Multiple ALT patterns to catch all variations
    'ALT': {
      regex: /(?:ALT\s*\(SGPT\))\s+(\d+\.?\d*)\s+U\/L\s+([\d\.\s\-<>]+)|(?:ALT\s*\(SGPT\))\s+(\d+\.?\d*)\s+U\/L|(?:ALT|SGPT|Alanine Aminotransferase)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'U/L'
    },
    // FIXED: Multiple AST patterns to catch all variations
    'AST': {
      regex: /(?:AST\s*\(SGOT\))\s+(\d+\.?\d*)\s+U\/L\s+([\d\.\s\-<>]+)|(?:AST\s*\(SGOT\))\s+(\d+\.?\d*)\s+U\/L|(?:AST|SGOT|Aspartate Aminotransferase)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'U/L'
    },
    'Alkaline Phosphatase': {
      regex: /(?:Alkaline Phosphatase)\s+(\d+\.?\d*)\s+U\/L\s+([\d\.\s\-<>]+)|(?:Alkaline Phosphatase|ALP)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'U/L'
    },
    'TSH': {
      regex: /(?:TSH)\s+(\d+\.?\d*)\s+(?:mIU\/L|μIU\/mL)\s+([\d\.\s\-<>]+)|(?:TSH|Thyroid Stimulating Hormone)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mIU/L'
    },
    'Free T4': {
      regex: /(?:Free T4)\s+(\d+\.?\d*)\s+ng\/dL\s+([\d\.\s\-<>]+)|(?:Free T4|FT4)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'ng/dL'
    },
    'Vitamin D': {
      regex: /(?:Vitamin D, 25-Hydroxy)\s+(\d+\.?\d*)\s+ng\/mL\s+([\d\.\s\-<>]+)|(?:Vitamin D|25-Hydroxy)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'ng/mL'
    },
    'Vitamin B12': {
      regex: /(?:Vitamin B12)\s+(\d+\.?\d*)\s+pg\/mL\s+([\d\.\s\-<>]+)|(?:Vitamin B12|B12)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'pg/mL'
    },
    // FIXED: Enhanced C-Reactive Protein pattern
    'C-Reactive Protein': {
      regex: /(?:C-Reactive Protein,?\s*High Sensitivity)\s+(\d+\.?\d*)\s+mg\/L\s+([\d\.\s\-<>]+)|(?:C-Reactive Protein|CRP)\s*:?\s*(\d+\.?\d*)/i,
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
      if (match) {
        // Handle multiple capture groups - find the first non-undefined value
        const value = parseFloat(match[1] || match[3] || match[4]);
        // Find the first non-undefined reference range
        const referenceRange = (match[2] && match[2].trim()) ? cleanReferenceRange(match[2]) : null;
        
        if (!isNaN(value)) {
          console.log(`Universal Parser: Found ${biomarkerName} = ${value} ${pattern.unit}${referenceRange ? ` (Range: ${referenceRange})` : ''}`);
          
          results[biomarkerName] = {
            value: value,
            unit: pattern.unit,
            rawText: match[0].trim(),
            referenceRange: referenceRange,
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
  
  // Additional patterns for biomarkers we might still miss
  const additionalPatterns = {
    'eGFR': {
      regex: /eGFR\s+(>?\d+\.?\d*)\s+mL\/min\/1\.73m²\s+([\d\.\s\-<>]*)|eGFR\s+(>?\d+\.?\d*)\s+mL\/min/i,
      unit: 'mL/min/1.73m²'
    },
    'Non-HDL Cholesterol': {
      regex: /(?:Non-HDL Cholesterol)\s+(\d+\.?\d*)\s+mg\/dL\s+([\d\.\s\-<>]+)|(?:Non-HDL Cholesterol|Non HDL)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'mg/dL'
    },
    'Folate': {
      regex: /(?:Folate)\s+(\d+\.?\d*)\s+ng\/mL\s+([\d\.\s\-<>]+)|(?:Folate|Folic Acid)\s*:?\s*(\d+\.?\d*)/i,
      unit: 'ng/mL'
    }
  };
  
  console.log('Additional Match: Looking for extra biomarkers...');
  
  // First pass - specific patterns
  for (const [biomarkerName, pattern] of Object.entries(additionalPatterns)) {
    try {
      const match = pattern.regex.exec(text);
      if (match) {
        const value = parseFloat(match[1] || match[3] || match[4]);
        const referenceRange = (match[2] && match[2].trim()) ? cleanReferenceRange(match[2]) : null;
        
        if (!isNaN(value)) {
          console.log(`Additional Match: ${biomarkerName} = ${value} ${pattern.unit}${referenceRange ? ` (Range: ${referenceRange})` : ''}`);
          results[biomarkerName] = {
            value: value,
            unit: pattern.unit,
            rawText: match[0].trim(),
            referenceRange: referenceRange,
            confidence: 0.8,
            source: 'additional'
          };
        }
      }
    } catch (error) {
      console.error(`Additional patterns: Error parsing ${biomarkerName}:`, error.message);
    }
  }
  
  // Second pass - aggressive fallback patterns for missing biomarkers
  const fallbackPatterns = {
    'Glucose': /(\d+\.?\d*)\s+mg\/dL\s+70\s*-\s*99/i,
    'ALT': /(\d+\.?\d*)\s+U\/L\s+7\s*-\s*56/i,
    'AST': /(\d+\.?\d*)\s+U\/L\s+10\s*-\s*40/i,
    'HDL Cholesterol': /(\d+\.?\d*)\s+mg\/dL\s+>\s*40/i
  };
  
  console.log('Fallback patterns: Looking for missing biomarkers with reference ranges...');
  
  for (const [biomarkerName, pattern] of Object.entries(fallbackPatterns)) {
    // Skip if we already found this biomarker
    if (results[biomarkerName]) {
      continue;
    }
    
    try {
      const match = pattern.exec(text);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          let unit = 'mg/dL';
          let referenceRange = null;
          
          if (biomarkerName === 'Glucose') {
            unit = 'mg/dL';
            referenceRange = '70 - 99';
          } else if (biomarkerName === 'ALT') {
            unit = 'U/L';
            referenceRange = '7 - 56';
          } else if (biomarkerName === 'AST') {
            unit = 'U/L';
            referenceRange = '10 - 40';
          } else if (biomarkerName === 'HDL Cholesterol') {
            unit = 'mg/dL';
            referenceRange = '>40';
          }
          
          console.log(`Fallback Match: ${biomarkerName} = ${value} ${unit} (Range: ${referenceRange})`);
          results[biomarkerName] = {
            value: value,
            unit: unit,
            rawText: match[0].trim(),
            referenceRange: referenceRange,
            confidence: 0.7,
            source: 'fallback'
          };
        }
      }
    } catch (error) {
      console.error(`Fallback patterns: Error parsing ${biomarkerName}:`, error.message);
    }
  }
  
  const additionalCount = Object.keys(results).length;
  if (additionalCount > 0) {
    console.log(`Universal Parser: Found ${additionalCount} additional biomarkers`);
  }
  
  return results;
}

/**
 * Clean and standardize reference ranges
 * @param {string} rawRange - Raw reference range text from OCR
 * @returns {string|null} Cleaned reference range or null if invalid
 */
function cleanReferenceRange(rawRange) {
  if (!rawRange || typeof rawRange !== 'string') {
    return null;
  }
  
  const cleaned = rawRange.trim();
  
  // Skip ranges that look like garbage or patient IDs
  if (cleaned.length > 20 || /^\d{6}-\d{3}$/.test(cleaned)) {
    return null;
  }
  
  // Handle common reference range formats
  if (/^\d+\.?\d*\s*[-–]\s*\d+\.?\d*$/.test(cleaned)) {
    // Standard "X.X - Y.Y" format
    return cleaned.replace(/\s*[-–]\s*/, ' - ');
  } else if (/^<\s*\d+\.?\d*$/.test(cleaned)) {
    // "< X.X" format
    return cleaned.replace(/^<\s*/, '<');
  } else if (/^>\s*\d+\.?\d*$/.test(cleaned)) {
    // "> X.X" format  
    return cleaned.replace(/^>\s*/, '>');
  } else if (/^>\d+\.?\d*$/.test(cleaned)) {
    // ">X.X" format (no space)
    return cleaned.replace(/^>/, '>');
  }
  
  return null;
}

/**
 * Clean up results to remove false positives
 */
function cleanupResults(results, originalText) {
  // For now, just return as-is, but this could be expanded to filter out
  // obviously invalid values based on context
  return results;
}

/**
 * Extract test date from text
 * @param {string} text - Raw OCR text
 * @returns {Date} Extracted date or current date
 */
function extractUniversalTestDate(text) {
  if (!text || typeof text !== 'string') {
    return new Date();
  }
  
  const datePatterns = [
    /Collection Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /Report Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/
  ];
  
  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime())) {
        console.log(`Universal Parser: Found test date: ${date}`);
        return date;
      }
    }
  }
  
  return new Date();
}

module.exports = {
  parseUniversalBiomarkers,
  extractUniversalTestDate
};