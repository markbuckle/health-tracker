// src/db/documentLoader.js
const fs = require("fs");
const path = require("path");
const { addDocument } = require("./medicalKnowledgeService");

/**
 * Load markdown files from a directory and add to the database
 * @param {string} directory - Path to directory containing markdown files
 */
async function loadDocumentsFromDirectory(directory) {
  console.log(`Loading documents from ${directory}...`);

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

        // Process metadata from the content
        const metadata = extractMetadata(content, fileName);
        const processedContent = processContent(content);

        try {
          await addDocument({
            title: metadata.title,
            content: processedContent,
            source: metadata.source || "Peter Attia MD",
            categories: metadata.categories || ["cardiovascular"],
            originalPath: filePath,
          });
          console.log(`Added document: ${metadata.title}`);
        } catch (error) {
          console.error(`Error adding document ${file}:`, error);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
  }
}

/**
 * Extract metadata from content
 * @param {string} content - File content
 * @param {string} fileName - Name of the file (without extension)
 * @returns {Object} - Metadata object
 */
function extractMetadata(content, fileName) {
  // Default metadata
  const metadata = {
    title: fileName.replace(/-/g, " "),
    source: "Peter Attia MD",
    categories: [],
  };

  // Try to extract title from the first line (if it starts with # or has a dash)
  const lines = content.split("\n");
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.startsWith("#")) {
      metadata.title = firstLine.replace(/^#+\s+/, "");
    } else if (firstLine.includes("‒") || firstLine.includes("-")) {
      const parts = firstLine.split(/‒|-/);
      if (parts.length >= 2) {
        // If format is like "#229 ‒ Understanding cardiovascular disease"
        metadata.title = parts.slice(1).join("-").trim();
        metadata.episodeNumber = parts[0].trim().replace(/^#/, "");
      }
    }
  }

  // Extract categories based on content keywords
  if (
    content.toLowerCase().includes("cardiovascular") ||
    content.toLowerCase().includes("heart") ||
    content.toLowerCase().includes("ascvd")
  ) {
    metadata.categories.push("cardiovascular");
  }

  if (
    content.toLowerCase().includes("cholesterol") ||
    content.toLowerCase().includes("lipid") ||
    content.toLowerCase().includes("apob")
  ) {
    metadata.categories.push("cholesterol");
  }

  if (
    content.toLowerCase().includes("diabetes") ||
    content.toLowerCase().includes("insulin")
  ) {
    metadata.categories.push("diabetes");
  }

  return metadata;
}

/**
 * Process content to make it more suitable for RAG
 * @param {string} content - Raw file content
 * @returns {string} - Processed content
 */
function processContent(content) {
  // Remove markdown formatting that's not helpful for the RAG system
  let processed = content;

  // Remove image references
  processed = processed.replace(/!\[.*?\]\(.*?\)/g, "");

  // Convert headers to plain text with emphasis
  processed = processed.replace(/#{1,6}\s+(.*?)$/gm, "$1:");

  // Handle bullet points
  processed = processed.replace(/^\s*[-*+]\s+/gm, "• ");

  // Handle numbered lists
  processed = processed.replace(/^\s*\d+\.\s+/gm, "• ");

  // Remove URLs but keep text
  processed = processed.replace(/\[(.*?)\]\(.*?\)/g, "$1");

  // Remove extra whitespace
  processed = processed.replace(/\n{3,}/g, "\n\n");

  return processed.trim();
}

module.exports = {
  loadDocumentsFromDirectory,
};
