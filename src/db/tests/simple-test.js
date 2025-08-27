// simple-test.js
const { query } = require("../pgConnector");

async function testDatabaseContent() {
  try {
    // List all documents
    const result = await query(
      "SELECT id, title, source FROM medical_documents"
    );
    console.log("Documents in database:", result.rows);

    // Check embeddings
    const embeddings = await query(
      "SELECT id, title, embedding IS NOT NULL as has_embedding FROM medical_documents"
    );
    console.log("Documents with embeddings:", embeddings.rows);

    // Test simple query without embeddings
    const titleSearch = await query(
      "SELECT id, title FROM medical_documents WHERE title ILIKE $1",
      ["%cholesterol%"]
    );
    console.log("Documents with 'cholesterol' in title:", titleSearch.rows);
  } catch (error) {
    console.error("Error:", error);
  }
}

testDatabaseContent().then(() => console.log("Done"));
