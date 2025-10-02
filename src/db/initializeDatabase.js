// src/db/initializeDatabase.js - UPDATED FOR NEW FOLDER STRUCTURE
const { loadDocumentsFromDirectory } = require("./documentLoader");
const path = require("path");
const fs = require("fs");

async function initializeDatabase() {
  const medicalKnowledgeDir = path.join(__dirname, "medicalKnowledge");

  try {
    console.log("\n🚀 ===== INITIALIZING MEDICAL KNOWLEDGE DATABASE =====\n");

    // Check if medicalKnowledge directory exists
    if (!fs.existsSync(medicalKnowledgeDir)) {
      console.error(`❌ Error: Directory not found: ${medicalKnowledgeDir}`);
      console.log("Please create the medicalKnowledge directory and add your documents.");
      return;
    }

    // Get all subdirectories in medicalKnowledge
    const subdirectories = fs.readdirSync(medicalKnowledgeDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    if (subdirectories.length === 0) {
      console.log("⚠️  No subdirectories found in medicalKnowledge folder.");
      console.log("Attempting to load documents directly from medicalKnowledge...");
      await loadDocumentsFromDirectory(medicalKnowledgeDir);
    } else {
      console.log(`📂 Found ${subdirectories.length} categories: ${subdirectories.join(", ")}\n`);

      // Load documents from each subdirectory
      for (const subdir of subdirectories) {
        const subdirPath = path.join(medicalKnowledgeDir, subdir);
        console.log(`\n📁 Loading ${subdir} documents...`);
        console.log(`   Path: ${subdirPath}`);
        
        try {
          await loadDocumentsFromDirectory(subdirPath);
          console.log(`✅ Completed loading ${subdir} documents\n`);
        } catch (error) {
          console.error(`❌ Error loading ${subdir}:`, error.message);
        }
      }
    }

    console.log("\n✅ ===== DATABASE INITIALIZATION COMPLETE! =====\n");
    
  } catch (error) {
    console.error("\n❌ ===== DATABASE INITIALIZATION FAILED =====");
    console.error("Error:", error);
    console.error("\nStack trace:", error.stack);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log("\n🎉 Done initializing database");
      process.exit(0);
    })
    .catch((err) => {
      console.error("\n❌ Failed to initialize database:", err);
      process.exit(1);
    });
}

module.exports = {
  initializeDatabase,
};