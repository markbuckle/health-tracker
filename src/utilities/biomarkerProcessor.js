// src/utilities/biomarkerProcessor.js

const { biomarkerData } = require('../parsers/biomarkerData');

/**
 * Process raw OCR biomarker data into standardized, clean format for database storage
 * @param {Object} rawLabValues - Raw biomarker data from OCR extraction
 * @returns {Object} Processed biomarker data with standardized names and clean ranges
 */
function processBiomarkersForStorage(rawLabValues) {
  console.log("🔄 Processing biomarkers for storage...");
  
  if (!rawLabValues || Object.keys(rawLabValues).length === 0) {
    return {};
  }
  
  const processedBiomarkers = {};
  
  /**
   * Find matching biomarker in biomarkerData.js using various matching strategies
   */
  function findBiomarkerMatch(testName) {
    if (!testName) return null;
    
    const testNameLower = testName.toLowerCase().trim();
    
    // 1. Direct name match
    for (const [standardName, data] of Object.entries(biomarkerData)) {
      if (standardName.toLowerCase() === testNameLower) {
        return [standardName, data];
      }
    }
    
    // 2. Check alternate names
    for (const [standardName, data] of Object.entries(biomarkerData)) {
      if (data.alternateNames && Array.isArray(data.alternateNames)) {
        for (const altName of data.alternateNames) {
          if (altName.toLowerCase() === testNameLower) {
            return [standardName, data];
          }
        }
      }
    }
    
    // 3. Fuzzy matching for partial names
    for (const [standardName, data] of Object.entries(biomarkerData)) {
      const standardLower = standardName.toLowerCase();
      if (testNameLower.length >= 4 && standardLower.includes(testNameLower)) {
        return [standardName, data];
      }
      if (standardLower.length >= 4 && testNameLower.includes(standardLower)) {
        return [standardName, data];
      }
    }
    
    return null;
  }
  
  /**
   * Validate and clean reference ranges, removing OCR garbage
   */
  function getCleanReferenceRange(rawRange, biomarkerInfo) {
    // If we have a standard reference range in biomarkerData, prefer that
    if (biomarkerInfo && biomarkerInfo.standardReferenceRange) {
      return biomarkerInfo.standardReferenceRange;
    }
    
    // Try to clean up the raw range
    if (rawRange && typeof rawRange === 'string') {
      const cleanRange = rawRange.trim();
      
      // Skip ranges that look like patient IDs, phone numbers, etc.
      if (/^\d{6}-\d{3}$/.test(cleanRange) ||     // 240731-001 pattern (patient ID)
          /^123-4567$/.test(cleanRange) ||        // 123-4567 pattern (phone number)
          /^\d{4}-\d{4}$/.test(cleanRange) ||     // XXXX-XXXX pattern
          cleanRange.length > 25 ||               // Too long to be a medical range
          /^[A-Z]{2,}-/.test(cleanRange)) {       // Starts with letters (likely not a range)
        return null;
      }
      
      // Check if it looks like a valid medical range
      if (/^\d+\.?\d*\s*[-–]\s*\d+\.?\d*/.test(cleanRange) ||  // X.X - Y.Y format
          /^[<>]\s*\d+\.?\d*/.test(cleanRange) ||              // >X or <X format
          /^\d+\.?\d*\s*to\s*\d+\.?\d*/.test(cleanRange)) {    // X to Y format
        return cleanRange;
      }
    }
    
    return null;
  }
  
  /**
   * Filter out Mongoose internal properties and get clean entries
   */
  function getCleanEntries(labValues) {
    const entries = [];
    
    // Handle both Map and regular object
    if (labValues instanceof Map) {
      for (const [key, value] of labValues.entries()) {
        if (!key.startsWith('$__') && !key.startsWith('_')) {
          entries.push([key, value]);
        }
      }
    } else if (typeof labValues === 'object' && labValues !== null) {
      // Use Object.keys to avoid inherited properties and filter out Mongoose internals
      for (const key of Object.keys(labValues)) {
        if (!key.startsWith('$__') && !key.startsWith('_') && 
            typeof labValues[key] === 'object' && labValues[key] !== null) {
          entries.push([key, labValues[key]]);
        }
      }
    }
    
    return entries;
  }
  
  // Get clean entries without Mongoose internals
  const cleanEntries = getCleanEntries(rawLabValues);
  console.log(`🔍 Processing ${cleanEntries.length} clean biomarker entries\n`);
  
  // Process each raw biomarker
  cleanEntries.forEach(([rawName, rawData]) => {
    // Skip if rawData is not a proper biomarker object
    if (!rawData || typeof rawData !== 'object' || rawData.value === undefined) {
      return;
    }
    
    const biomarkerMatch = findBiomarkerMatch(rawName);
    
    if (biomarkerMatch) {
      const [standardName, biomarkerInfo] = biomarkerMatch;
      
      // Clean up the reference range
      const cleanReferenceRange = getCleanReferenceRange(rawData.referenceRange, biomarkerInfo);
      
      // Store using standardized name with cleaned data
      processedBiomarkers[standardName] = {
        value: rawData.value,
        unit: rawData.unit || '',
        rawText: rawData.rawText || '',
        referenceRange: cleanReferenceRange,
        confidence: rawData.confidence || 0.8,
        // Additional fields for processing context
        category: biomarkerInfo.category,
        description: biomarkerInfo.description,
        frequency: biomarkerInfo.frequency,
        originalName: rawName, // Keep track for debugging if needed
        matched: true,
        processedAt: new Date()
      };
    } else {
      // For unmatched biomarkers, still clean them up but mark as unmatched
      const cleanReferenceRange = getCleanReferenceRange(rawData.referenceRange, null);
      
      processedBiomarkers[rawName] = {
        value: rawData.value,
        unit: rawData.unit || '',
        rawText: rawData.rawText || '',
        referenceRange: cleanReferenceRange,
        confidence: rawData.confidence || 0.5,
        // Additional fields for processing context
        category: 'unknown',
        description: `Unmatched biomarker: ${rawName}`,
        frequency: 'unknown',
        originalName: rawName,
        matched: false,
        processedAt: new Date()
      };
    }
  });
  
  // Clean, compact logging with biomarker details
  if (Object.keys(processedBiomarkers).length > 0) {
    console.log("📊 PROCESSED BIOMARKERS:");
    console.log("=" + "=".repeat(70));
    
    Object.entries(processedBiomarkers).forEach(([name, data]) => {
      const value = `${data.value} ${data.unit}`.trim();
      const range = data.referenceRange || 'No range';
      const category = data.category.toUpperCase();
      
      console.log(`${name.padEnd(20)} │ ${value.padEnd(12)} │ ${range.padEnd(15)} │ ${category}`);
    });
    
    console.log("=" + "=".repeat(70));
  }
  
  console.log(`🎯 Processing complete: ${Object.keys(processedBiomarkers).length} biomarkers processed\n`);
  return processedBiomarkers;
}

/**
 * Migration function for existing files with raw data
 * Fixed to properly handle MongoDB Map type for labValues
 */
async function migrateExistingFilesToProcessedData(user) {
  try {
    console.log("🔄 Migrating existing files to processed data...");
    
    if (!user || !user.files) {
      console.log("No user or files found");
      return { migrated: 0, message: "No files to migrate" };
    }
    
    let migrationCount = 0;
    let hasChanges = false;
    
    user.files.forEach(file => {
      // Only process files that explicitly need migration
      const hasLabValues = file.labValues && (
        file.labValues instanceof Map ? file.labValues.size > 0 : Object.keys(file.labValues).length > 0
      );
      const needsProcessing = file.biomarkerProcessingComplete !== true;
      
      if (hasLabValues && needsProcessing) {
        console.log(`🔄 Migrating file: ${file.originalName}`);
        
        // Convert Map to plain object for processing
        let rawLabValues = {};
        if (file.labValues instanceof Map) {
          rawLabValues = Object.fromEntries(file.labValues);
        } else {
          rawLabValues = file.labValues;
        }
        
        // Process the raw labValues
        const processedLabValues = processBiomarkersForStorage(rawLabValues);
        
        // Only proceed if we have valid processed data
        if (Object.keys(processedLabValues).length > 0) {
          // Create a new Map for MongoDB
          const labValuesMap = new Map();
          
          // Populate the Map with processed data
          Object.entries(processedLabValues).forEach(([biomarkerName, biomarkerData]) => {
            labValuesMap.set(biomarkerName, {
              value: biomarkerData.value,
              unit: biomarkerData.unit || '',
              rawText: biomarkerData.rawText || '',
              referenceRange: biomarkerData.referenceRange || null,
              confidence: biomarkerData.confidence || 0.8,
              // Add the additional processed fields
              category: biomarkerData.category,
              description: biomarkerData.description,
              frequency: biomarkerData.frequency,
              originalName: biomarkerData.originalName,
              matched: biomarkerData.matched,
              processedAt: biomarkerData.processedAt
            });
          });
          
          // Replace with processed data and mark as complete
          file.labValues = labValuesMap;
          file.biomarkerProcessingComplete = true;
          file.migratedAt = new Date();
          file.totalBiomarkersProcessed = labValuesMap.size;
          
          migrationCount++;
          hasChanges = true;
          
          console.log(`✅ Processed ${labValuesMap.size} biomarkers for: ${file.originalName}`);
        } else {
          console.log(`⚠️ No valid biomarkers processed for file: ${file.originalName}`);
          // Still mark as processed to prevent re-processing
          file.biomarkerProcessingComplete = true;
          file.migratedAt = new Date();
          file.totalBiomarkersProcessed = 0;
          hasChanges = true;
        }
      } else if (hasLabValues && file.biomarkerProcessingComplete === true) {
        // File already processed, skip silently
      } else {
        // No lab values, mark as processed to prevent future checks
        if (file.biomarkerProcessingComplete !== true) {
          file.biomarkerProcessingComplete = true;
          file.migratedAt = new Date();
          file.totalBiomarkersProcessed = 0;
          hasChanges = true;
        }
      }
    });
    
    if (hasChanges) {
      await user.save();
      if (migrationCount > 0) {
        console.log(`✅ Migration complete: ${migrationCount} files processed`);
      }
      return { 
        migrated: migrationCount, 
        message: migrationCount > 0 
          ? `Successfully migrated ${migrationCount} files to processed data format`
          : "Files marked as processed"
      };
    } else {
      console.log("No files needed migration");
      return { migrated: 0, message: "All files already processed" };
    }
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  }
}

module.exports = {
  processBiomarkersForStorage,
  migrateExistingFilesToProcessedData
};