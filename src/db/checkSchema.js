// src/db/checkSchema.js
const db = require("./pgConnector");

async function checkDatabaseSchema() {
  try {
    // Check if pgvector extension is installed
    console.log("Checking pgvector extension...");
    const extResult = await db.query(
      "SELECT * FROM pg_extension WHERE extname = 'vector'"
    );

    if (extResult.rows.length === 0) {
      console.error("pgvector extension is not installed!");
      console.log("Please run: CREATE EXTENSION vector;");
    } else {
      console.log("pgvector extension is installed correctly.");
    }

    // Check if medical_documents table exists
    console.log("Checking medical_documents table...");
    const tableResult = await db.query(
      "SELECT to_regclass('public.medical_documents')"
    );

    if (!tableResult.rows[0].to_regclass) {
      console.error("medical_documents table doesn't exist!");
      console.log(`
        CREATE TABLE medical_documents (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          source TEXT DEFAULT 'Unknown',
          categories TEXT[] DEFAULT '{}',
          embedding vector(1536)
        );
      `);
    } else {
      // Count documents in the table
      const countResult = await db.query(
        "SELECT COUNT(*) FROM medical_documents"
      );
      console.log(`Table contains ${countResult.rows[0].count} documents`);

      // Check if any documents have embeddings
      const embeddingResult = await db.query(
        "SELECT COUNT(*) FROM medical_documents WHERE embedding IS NOT NULL"
      );
      console.log(`${embeddingResult.rows[0].count} documents have embeddings`);
    }
  } catch (error) {
    console.error("Error checking schema:", error);
  }
}

// Run if called directly
if (require.main === module) {
  checkDatabaseSchema()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { checkDatabaseSchema };
