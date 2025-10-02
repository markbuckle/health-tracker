// src/db/documentLoader.js - ENHANCED WITH IMPROVED CHUNKING
const fs = require("fs");
const path = require("path");
const { addDocument } = require("./medicalKnowledgeService");

// ============================================
// PRIORITY 4: IMPROVED CHUNKING STRATEGY
// ============================================

/**
 * Chunk a large document by headers with intelligent sub-chunking
 * Handles both ## and ### headers for optimal chunk sizes
 */
function chunkDocumentByHeaders(content, baseTitle, sourceFile) {
  const chunks = [];
  
  // Split by ## headers (main sections)
  const sections = content.split(/(?=^## )/gm);
  
  console.log(`  Found ${sections.length} main sections to process`);
  
  sections.forEach((section, index) => {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 100) return; // Skip tiny sections
    
    // Extract the main section header
    const headerMatch = trimmed.match(/^##\s+(.+?)$/m);
    const mainSectionHeader = headerMatch ? headerMatch[1].trim() : 'Introduction';
    
    // ==========================================
    // NEW: Smart chunking based on size
    // ==========================================
    
    // If section is too large (>4000 chars), split on ### subsections
    if (trimmed.length > 4000) {
      console.log(`  ⚠️  Large section detected (${trimmed.length} chars) - splitting into subsections`);
      
      const subsections = trimmed.split(/(?=^### )/gm);
      
      subsections.forEach((subsection, subIndex) => {
        const subTrimmed = subsection.trim();
        if (subTrimmed.length < 100) return; // Skip tiny subsections
        
        // Extract subsection header if exists
        const subHeaderMatch = subTrimmed.match(/^###\s+(.+?)$/m);
        const subHeader = subHeaderMatch ? subHeaderMatch[1].trim() : '';
        
        // Further split if subsection is still too large (>3000 chars)
        if (subTrimmed.length > 3000) {
          console.log(`  ⚠️  Large subsection detected (${subTrimmed.length} chars) - creating overlapping chunks`);
          
          // Create overlapping chunks for very large subsections
          const chunkSize = 2500;
          const overlap = 250;
          let startPos = 0;
          let chunkNum = 0;
          
          while (startPos < subTrimmed.length) {
            const endPos = Math.min(startPos + chunkSize, subTrimmed.length);
            const chunkText = subTrimmed.substring(startPos, endPos);
            
            if (chunkText.trim().length >= 100) {
              chunks.push({
                title: `${baseTitle} - ${mainSectionHeader}${subHeader ? ' - ' + subHeader : ''} (Part ${chunkNum + 1})`,
                content: chunkText.trim(),
                source: "Peter Attia MD",
                categories: detectCategories(chunkText),
                sectionHeader: `${mainSectionHeader}${subHeader ? ' > ' + subHeader : ''} (Part ${chunkNum + 1})`,
                chunkIndex: index * 1000 + subIndex * 100 + chunkNum,
                parentDocument: baseTitle,
                contentLength: chunkText.trim().length,
                originalPath: sourceFile,
                isOverlapping: true
              });
              chunkNum++;
            }
            
            startPos += (chunkSize - overlap);
          }
        } else {
          // Normal-sized subsection
          chunks.push({
            title: `${baseTitle} - ${mainSectionHeader}${subHeader ? ' - ' + subHeader : ''}`,
            content: subTrimmed,
            source: "Peter Attia MD",
            categories: detectCategories(subTrimmed),
            sectionHeader: `${mainSectionHeader}${subHeader ? ' > ' + subHeader : ''}`,
            chunkIndex: index * 1000 + subIndex,
            parentDocument: baseTitle,
            contentLength: subTrimmed.length,
            originalPath: sourceFile,
            isOverlapping: false
          });
        }
      });
      
    } else {
      // Section is reasonable size - add as single chunk
      chunks.push({
        title: `${baseTitle} - ${mainSectionHeader}`,
        content: trimmed,
        source: "Peter Attia MD",
        categories: detectCategories(trimmed),
        sectionHeader: mainSectionHeader,
        chunkIndex: index,
        parentDocument: baseTitle,
        contentLength: trimmed.length,
        originalPath: sourceFile,
        isOverlapping: false
      });
    }
  });
  
  console.log(`  ✂️  Created ${chunks.length} total chunks`);
  return chunks;
}

// ============================================
// ENHANCED CATEGORY DETECTION
// ============================================

/**
 * Detect categories from content with improved keyword matching
 */
function detectCategories(content) {
  const categories = [];
  const contentLower = content.toLowerCase();
  
  const categoryMap = {
    cardiovascular: [
      'cholesterol', 'cardiovascular', 'heart disease', 'ascvd', 'ldl', 'hdl',
      'atherosclerosis', 'arterial', 'coronary', 'cardiac', 'blood pressure',
      'hypertension', 'stroke', 'heart attack', 'myocardial'
    ],
    exercise: [
      'exercise', 'vo2', 'fitness', 'workout', 'training', 'physical activity',
      'aerobic', 'strength', 'endurance', 'muscle', 'zone 2', 'intensity'
    ],
    oncology: [
      'cancer', 'tumor', 'oncology', 'malignancy', 'chemotherapy',
      'carcinoma', 'metastasis', 'neoplasm'
    ],
    nutrition: [
      'diet', 'food', 'nutrition', 'eating', 'meal', 'calorie',
      'macronutrient', 'protein', 'carbohydrate', 'fat', 'ketogenic',
      'fasting', 'intermittent fasting'
    ],
    metabolic: [
      'diabetes', 'insulin', 'glucose', 'metabolic', 'blood sugar',
      'a1c', 'glycemic', 'metabolic syndrome'
    ],
    longevity: [
      'longevity', 'aging', 'lifespan', 'mortality', 'centenarian',
      'healthspan', 'life expectancy'
    ],
    sleep: [
      'sleep', 'insomnia', 'circadian', 'rem sleep', 'sleep quality',
      'sleep deprivation'
    ],
    mental_health: [
      'mental health', 'depression', 'anxiety', 'cognitive', 'brain health',
      'alzheimer', 'dementia', 'neurological'
    ]
  };
  
  for (const [category, keywords] of Object.entries(categoryMap)) {
    // Count matches for each category
    const matchCount = keywords.filter(keyword => 
      contentLower.includes(keyword)
    ).length;
    
    // If 2+ keywords match, add category (or 1+ for specific important keywords)
    if (matchCount >= 2 || 
        (matchCount >= 1 && ['cancer', 'diabetes', 'alzheimer'].some(kw => contentLower.includes(kw)))) {
      categories.push(category);
    }
  }
  
  // Default to 'health' if no specific categories detected
  if (categories.length === 0) {
    categories.push('health', 'preventative');
  }
  
  return categories;
}

// ============================================
// DOCUMENT LOADING
// ============================================

/**
 * Load markdown files from a directory and add to the database
 */
async function loadDocumentsFromDirectory(directory) {
  console.log(`\n📂 Loading documents from ${directory}...`);

  try {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        // Recursively process subdirectories
        await loadDocumentsFromDirectory(filePath);
      } else if (file.endsWith(".md")) {
        const content = fs.readFileSync(filePath, "utf8");
        const fileName = path.basename(file, ".md");

        // Process metadata
        const metadata = extractMetadata(content, fileName);
        const processedContent = processContent(content);

        console.log(`\n📄 Processing: ${metadata.title}`);
        console.log(`   Size: ${processedContent.length} chars`);

        try {
          // Check if document is large (> 15KB or 15,000 chars)
          if (processedContent.length > 15000) {
            console.log(`   ⚠️  Large document detected - using intelligent chunking...`);
            
            const chunks = chunkDocumentByHeaders(
              processedContent,
              metadata.title,
              filePath
            );
            
            console.log(`   ✂️  Split into ${chunks.length} optimized chunks`);
            
            for (const chunk of chunks) {
              await addDocument(chunk);
              console.log(`      ✅ Added: "${chunk.sectionHeader}" (${chunk.contentLength} chars)${chunk.isOverlapping ? ' [overlapping]' : ''}`);
            }
            
            console.log(`   ✅ Completed chunking for ${metadata.title}`);
          } else {
            // Small document - add as single piece
            await addDocument({
              title: metadata.title,
              content: processedContent,
              source: metadata.source || "Peter Attia MD",
              categories: metadata.categories || detectCategories(processedContent),
              originalPath: filePath,
              chunkIndex: 0,
              parentDocument: metadata.title,
              contentLength: processedContent.length,
              isOverlapping: false
            });
            console.log(`   ✅ Added as single document`);
          }
        } catch (error) {
          console.error(`   ❌ Error adding document ${file}:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error(`❌ Error reading directory ${directory}:`, error);
  }
}

// ============================================
// METADATA EXTRACTION
// ============================================

/**
 * Extract metadata from content with improved detection
 */
function extractMetadata(content, fileName) {
  const metadata = {
    title: fileName.replace(/-/g, " "),
    source: "Peter Attia MD",
    categories: [],
  };

  const lines = content.split("\n");
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    
    // Extract title from first header
    if (firstLine.startsWith("#")) {
      metadata.title = firstLine.replace(/^#+\s+/, "");
    } else if (firstLine.includes("‒") || firstLine.includes("-")) {
      const parts = firstLine.split(/‒|-/);
      if (parts.length >= 2) {
        metadata.title = parts[0].trim();
      }
    }
  }

  // Use enhanced category detection
  metadata.categories = detectCategories(content);

  return metadata;
}

// ============================================
// CONTENT PROCESSING
// ============================================

/**
 * Process content - clean up formatting while preserving structure
 */
function processContent(content) {
  return content
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    // Remove excessive blank lines (more than 2)
    .replace(/\n{3,}/g, "\n\n")
    // Trim whitespace
    .trim();
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  loadDocumentsFromDirectory,
  chunkDocumentByHeaders,
  extractMetadata,
  processContent,
  detectCategories
};

console.log('✅ documentLoader.js loaded with enhanced chunking capabilities');