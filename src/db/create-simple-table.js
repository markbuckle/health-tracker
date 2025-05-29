// src/db/create-simple-table.js
const { query } = require("./pgConnector");

async function createSimpleTable() {
  try {
    console.log("Creating simple medical_documents table...");
    
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS medical_documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT DEFAULT 'Unknown',
        categories TEXT[] DEFAULT '{}',
        embedding BYTEA
      );
    `;
    
    await query(createTableQuery);
    console.log("Table created successfully!");
    
    // Create a text search index
    const createIndexQuery = `
      CREATE INDEX IF NOT EXISTS idx_medical_documents_content 
      ON medical_documents USING gin(to_tsvector('english', content));
    `;
    
    await query(createIndexQuery);
    console.log("Index created successfully!");
    
  } catch (error) {
    console.error("Error creating table:", error);
  }
}

// Run if called directly
if (require.main === module) {
  createSimpleTable()
    .then(() => {
      console.log("Done creating table");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Failed to create table:", err);
      process.exit(1);
    });
}

module.exports = { createSimpleTable };