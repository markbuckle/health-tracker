// src/db/documentLoader.js - WITH CHUNKING
const fs = require("fs");
const path = require("path");
const { addDocument } = require("./medicalKnowledgeService");

/**
 * Chunk a large document by ## headers
 */
function chunkDocumentByHeaders(content, baseTitle, sourceFile) {
  const chunks = [];
  
  // Split by ## headers (main sections)
  const sections = content.split(/(?=^## )/gm);
  
  console.log(`  Found ${sections.length} sections to process`);
  
  sections.forEach((section, index) => {
    const trimmed = section.trim();
    if (!trimmed || trimmed.length < 100) return; // Skip tiny sections
    
    // Extract the section header
    const headerMatch = trimmed.match(/^##\s+(.+?)$/m);
    const sectionHeader = headerMatch ? headerMatch[1].trim() : 'Introduction';
    
    // Create chunk
    chunks.push({
      title: `${baseTitle} - ${sectionHeader}`,
      content: trimmed,
      source: "Peter Attia MD",
      categories: ["health", "preventative"],
      sectionHeader: sectionHeader,
      chunkIndex: index,
      parentDocument: baseTitle,
      contentLength: trimmed.length,
      originalPath: sourceFile
    });
  });
  
  return chunks;
}

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
          // Check if document is large (> 15KB)
          if (processedContent.length > 15000) {
            console.log(`   ⚠️  Large document detected - chunking into sections...`);
            
            const chunks = chunkDocumentByHeaders(
              processedContent,
              metadata.title,
              filePath
            );
            
            console.log(`   ✂️  Split into ${chunks.length} chunks`);
            
            for (const chunk of chunks) {
              await addDocument(chunk);
              console.log(`      ✅ Added: "${chunk.sectionHeader}" (${chunk.contentLength} chars)`);
            }
            
            console.log(`   ✅ Completed chunking for ${metadata.title}`);
          } else {
            // Small document - add as single piece
            await addDocument({
              title: metadata.title,
              content: processedContent,
              source: metadata.source || "Peter Attia MD",
              categories: metadata.categories || ["cardiovascular"],
              originalPath: filePath,
              chunkIndex: 0,
              parentDocument: metadata.title,
              contentLength: processedContent.length
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

/**
 * Extract metadata from content
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
    if (firstLine.startsWith("#")) {
      metadata.title = firstLine.replace(/^#+\s+/, "");
    } else if (firstLine.includes("‒") || firstLine.includes("-")) {
      const parts = firstLine.split(/‒|-/);
      if (parts.length >= 2) {
        metadata.title = parts[0].trim();
      }
    }
  }

  // Detect categories from content
  const contentLower = content.toLowerCase();
  if (contentLower.includes("cholesterol") || contentLower.includes("cardiovascular")) {
    metadata.categories.push("cardiovascular");
  }
  if (contentLower.includes("exercise") || contentLower.includes("vo2")) {
    metadata.categories.push("exercise");
  }
  if (contentLower.includes("cancer")) {
    metadata.categories.push("oncology");
  }

  return metadata;
}

/**
 * Process content - clean up formatting
 */
function processContent(content) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

module.exports = {
  loadDocumentsFromDirectory,
  chunkDocumentByHeaders,
  extractMetadata,
  processContent
};