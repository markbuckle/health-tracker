// src/parsers/biomarkerParser.js - IMPROVED VERSION
// Prioritizes accuracy while maintaining flexibility

/**
 * Universal biomarker parser with improved accuracy
 * @param {string} ocrText - Raw OCR text from any provider
 * @returns {Object} Extracted biomarkers with values, units, and reference ranges
 */
function parseUniversalBiomarkers(ocrText) {
  console.log('🧬 Universal Biomarker Parser: Starting analysis...');
  
  if (!ocrText || ocrText.length === 0) {
    console.log('Universal Parser: No text provided');
    return {};
  }
  
  let labPatterns = {};
  let biomarkerData = {};
  
  // Try to import existing patterns and data
  try {
    const patterns = require('./labPatterns');
    labPatterns = patterns.labPatterns || {};
    console.log(`Universal Parser: Loaded ${Object.keys(labPatterns).length} lab patterns`);
    
    try {
      const data = require('./biomarkerData');
      biomarkerData = data.biomarkerData || data;
      console.log(`Universal Parser: Loaded biomarker reference data`);
    } catch (bioDataError) {
      console.log('Universal Parser: No biomarkerData.js found, using patterns only');
    }
    
  } catch (error) {
    console.error('Universal Parser: Could not load labPatterns:', error.message);
    return fallbackBasicParsing(ocrText);
  }
  
  const results = {};
  
  // PRIORITY 1: Try structured parsing first (most accurate for your PDFs)
  const structuredResults = parseStructuredFormat(ocrText, biomarkerData);
  Object.assign(results, structuredResults);
  
  // PRIORITY 2: Add missing biomarkers with additional patterns
  const additionalResults = parseAdditionalBiomarkers(ocrText);
  // Only add if not already found by structured parsing
  for (const [name, data] of Object.entries(additionalResults)) {
    if (!results[name]) {
      results[name] = data;
    }
  }
  
  // PRIORITY 3: Use lab patterns only for biomarkers not yet found
  const patternResults = parseWithLabPatterns(ocrText, labPatterns, results);
  Object.assign(results, patternResults);
  
  // Clean up results - remove obvious false positives
  const cleanedResults = cleanupResults(results, ocrText);
  
  const totalFound = Object.keys(cleanedResults).length;
  console.log(`🧬 Universal Parser: Found ${totalFound} biomarkers total`);
  
  if (totalFound > 0) {
    console.log('Universal Parser: Biomarkers found:', Object.keys(cleanedResults));
  }
  
  return cleanedResults;
}

/**
 * Parse structured table-like format (HIGHEST PRIORITY - most accurate)
 */
function parseStructuredFormat(text, biomarkerData) {
  const results = {};
  
  // Look for table-like structures with Test Name | Result | Units | Reference Range
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  
  let inDataSection = false;
  let processedCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip header lines
    if (line.match(/^(Test Name|Result|Units|Reference Range|Category|Flag)/i)) {
      inDataSection = true;
      continue;
    }
    
    // Skip section headers
    if (line.match(/^(METABOLIC|KIDNEY|ELECTROLYTES|LIVER|CARDIOVASCULAR|HORMONES|NUTRIENTS|IMMUNITY)/i)) {
      continue;
    }
    
    if (inDataSection && line.length > 10) {
      const parsed = parseStructuredLine(line, biomarkerData);
      if (parsed) {
        console.log(`Structured Parse: ${parsed.testName} = ${parsed.value} ${parsed.unit}`);
        results[parsed.testName] = {
          value: parsed.value,
          unit: parsed.unit,
          rawText: line,
          referenceRange: parsed.referenceRange,
          flag: parsed.flag,
          confidence: 0.95,
          source: 'structured'
        };
        processedCount++;
      }
    }
  }
  
  console.log(`Universal Parser: Found ${processedCount} biomarkers using structured parsing`);
  return results;
}

/**
 * Parse a single line from structured format
 */
function parseStructuredLine(line, biomarkerData) {
  // Enhanced patterns with better biomarker name matching
  const patterns = [
    // Specific biomarker patterns for your PDFs
    /^(Glucose)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Creatinine)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(eGFR)\s+(>?\d+\.?\d*)\s+(mL\/min\/1\.73m²)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Sodium)\s+(\d+\.?\d*)\s+(mmol\/L)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Potassium)\s+(\d+\.?\d*)\s+(mmol\/L)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Albumin)\s+(\d+\.?\d*)\s+(g\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Total Bilirubin)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Alkaline Phosphatase)\s+(\d+\.?\d*)\s+(U\/L)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(ALT \(SGPT\))\s+(\d+\.?\d*)\s+(U\/L)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(AST \(SGOT\))\s+(\d+\.?\d*)\s+(U\/L)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Total Cholesterol)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Triglycerides)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(HDL Cholesterol)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(LDL Cholesterol)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Non-HDL Cholesterol)\s+(\d+\.?\d*)\s+(mg\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(TSH)\s+(\d+\.?\d*)\s+(mIU\/L)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Free T4)\s+(\d+\.?\d*)\s+(ng\/dL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Vitamin D, 25-Hydroxy)\s+(\d+\.?\d*)\s+(ng\/mL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Vitamin B12)\s+(\d+\.?\d*)\s+(pg\/mL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(Folate)\s+(\d+\.?\d*)\s+(ng\/mL)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    /^(C-Reactive Protein, High Sensitivity)\s+(\d+\.?\d*)\s+(mg\/L)\s+([0-9\s\-<>\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/i,
    
    // Generic fallback pattern
    /^([A-Za-z\s\-(),]+?)\s+(\d+\.?\d*)\s+([a-zA-Z%\/\^²2μµ]+)\s+([<>\d\s\-\.]+)?\s*([A-Z]+)?\s*([A-Z]*)?/
  ];
  
  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      const testName = match[1].trim();
      const value = parseFloat(match[2]);
      const unit = match[3];
      const referenceRange = match[4] && !match[4].match(/^[A-Z]+$/) ? match[4].trim() : null;
      const flag = match[5] && match[5].match(/^(HIGH|LOW|NORMAL)$/) ? match[5] : null;
      
      if (!isNaN(value) && testName.length > 2) {
        return {
          testName: standardizeBiomarkerName(testName),
          value: value,
          unit: unit,
          referenceRange: referenceRange,
          flag: flag
        };
      }
    }
  }
  
  return null;
}

/**
 * Parse additional biomarkers not caught by structured parsing
 */
function parseAdditionalBiomarkers(text) {
  const results = {};
  
  // Only look for biomarkers commonly missed by structured parsing
  const additionalPatterns = {
    'eGFR': {
      regex: /eGFR\s+(>?\d+\.?\d*)\s+mL\/min/im,
      unit: 'mL/min/1.73m²'
    },
    'Non-HDL Cholesterol': {
      regex: /Non-HDL Cholesterol\s+(\d+\.?\d*)\s+mg\/dL/im,
      unit: 'mg/dL'
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
 * Parse using existing labPatterns.js - but only for biomarkers not already found
 */
function parseWithLabPatterns(text, labPatterns, alreadyFound) {
  const results = {};
  
  if (!labPatterns || Object.keys(labPatterns).length === 0) {
    return results;
  }
  
  // Create a whitelist of biomarkers that are safe to use from labPatterns
  const safePatterns = [
    'TSH', 'Free T4', 'Vitamin D', 'Vitamin B12', 'Folate', 'C-Reactive Protein'
  ];
  
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  let matchCount = 0;
  
  for (const [biomarkerName, pattern] of Object.entries(labPatterns)) {
    try {
      // Skip if already found by structured parsing
      if (alreadyFound[biomarkerName]) continue;
      
      // Only use safe patterns to avoid unit conflicts
      if (!safePatterns.includes(biomarkerName)) continue;
      
      if (!pattern.regex) continue;
      
      const match = pattern.regex.exec(normalizedText);
      if (match && match[1]) {
        const value = parseFloat(match[1]);
        if (!isNaN(value)) {
          console.log(`Safe Pattern Match: ${biomarkerName} = ${value} ${pattern.standardUnit || ''}`);
          
          results[biomarkerName] = {
            value: value,
            unit: pattern.standardUnit || '',
            rawText: match[0].trim(),
            referenceRange: null,
            confidence: 0.8,
            source: 'labPattern-safe'
          };
          matchCount++;
        }
      }
    } catch (error) {
      console.error(`Error parsing ${biomarkerName}:`, error.message);
    }
  }
  
  console.log(`Universal Parser: Found ${matchCount} biomarkers using safe lab patterns`);
  return results;
}

/**
 * Clean up results - remove obvious false positives
 */
function cleanupResults(results, originalText) {
  const cleaned = {};
  
  // Biomarkers that shouldn't appear in typical lab reports
  const falsePositivePatterns = [
    'Free Testosterone', 'Selenium', 'Arsenic', 'Lead', 'Mercury'
  ];
  
  for (const [name, data] of Object.entries(results)) {
    // Skip obvious false positives unless they're clearly mentioned in the text
    if (falsePositivePatterns.includes(name)) {
      if (!originalText.toLowerCase().includes(name.toLowerCase())) {
        console.log(`Cleanup: Removing likely false positive: ${name}`);
        continue;
      }
    }
    
    // Keep this biomarker
    cleaned[name] = data;
  }
  
  return cleaned;
}

/**
 * Standardize biomarker names
 */
function standardizeBiomarkerName(name) {
  const nameMap = {
    'Total Cholesterol': 'Total Cholesterol',
    'HDL Cholesterol': 'HDL Cholesterol', 
    'LDL Cholesterol': 'LDL Cholesterol',
    'Triglycerides': 'Triglycerides',
    'Glucose': 'Glucose',
    'Creatinine': 'Creatinine',
    'Sodium': 'Sodium',
    'Potassium': 'Potassium',
    'Albumin': 'Albumin',
    'Total Bilirubin': 'Total Bilirubin',
    'ALT (SGPT)': 'ALT',
    'AST (SGOT)': 'AST',
    'Alkaline Phosphatase': 'Alkaline Phosphatase',
    'TSH': 'TSH',
    'Free T4': 'Free T4',
    'Vitamin D, 25-Hydroxy': 'Vitamin D',
    'Vitamin B12': 'Vitamin B12',
    'C-Reactive Protein, High Sensitivity': 'C-Reactive Protein',
    'Non-HDL Cholesterol': 'Non-HDL Cholesterol',
    'Folate': 'Folate',
    'eGFR': 'eGFR'
  };
  
  return nameMap[name] || name;
}

/**
 * Fallback basic parsing if labPatterns can't be loaded
 */
function fallbackBasicParsing(text) {
  console.log('Universal Parser: Using fallback basic parsing');
  
  const basicPatterns = {
    'Total Cholesterol': /Total Cholesterol\s+(\d+\.?\d*)\s+mg\/dL/i,
    'HDL Cholesterol': /HDL Cholesterol\s+(\d+\.?\d*)\s+mg\/dL/i,
    'LDL Cholesterol': /LDL Cholesterol\s+(\d+\.?\d*)\s+mg\/dL/i,
    'Triglycerides': /Triglycerides\s+(\d+\.?\d*)\s+mg\/dL/i,
    'Glucose': /Glucose\s+(\d+\.?\d*)\s+mg\/dL/i,
    'Creatinine': /Creatinine\s+(\d+\.?\d*)\s+mg\/dL/i
  };
  
  const results = {};
  
  for (const [name, pattern] of Object.entries(basicPatterns)) {
    const match = text.match(pattern);
    if (match) {
      results[name] = {
        value: parseFloat(match[1]),
        unit: 'mg/dL',
        rawText: match[0],
        referenceRange: null,
        confidence: 0.7,
        source: 'fallback'
      };
    }
  }
  
  return results;
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
  extractUniversalTestDate,
  parseStructuredFormat,
  standardizeBiomarkerName
};