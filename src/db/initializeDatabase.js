// src/db/initializeDatabase.js
const { loadDocumentsFromDirectory } = require("./documentLoader");
const path = require("path");

async function initializeDatabase() {
  const medicalKnowledgeDir = path.join(__dirname, "medicalKnowledge");

  try {
    console.log("Initializing medical knowledge database...");

    // Load documents from Peter Attia folder
    const peterAttiaDir = path.join(medicalKnowledgeDir, "peterAttia");
    await loadDocumentsFromDirectory(peterAttiaDir);

    console.log("Database initialization complete!");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log("Done initializing database");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to initialize database:", err);
      process.exit(1);
    });
}

module.exports = {
  initializeDatabase,
};
