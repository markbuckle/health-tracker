const db = require("./pgConnector");
const llmService = require("./chatService");

// Function to add a simple document to the knowledge base
async function addDocument(document) {
  try {
    const { title, content, source = "Unknown", categories = [] } = document;

    // Generate embedding for the document
    console.log("Generating embedding for document:", title);
    const embedding = await llmService.generateEmbedding(content);

    // Format the embedding as an array for pgvector
    // This is the key fix - we need to pass the vector as a properly formatted array

    // Insert the document with its embedding
    const text = `
      INSERT INTO medical_literature (
        title, content, source, categories, embedding
      )
      VALUES ($1, $2, $3, $4, $5::vector)
      RETURNING id`;

    const values = [title, content, source, categories, embedding];

    const result = await db.query(text, values);
    console.log(`Document inserted with ID: ${result.rows[0].id}`);

    return result.rows[0].id;
  } catch (error) {
    console.error("Error adding document to knowledge base:", error);
    throw error;
  }
}

// Function to test if we can add a document
async function testAddDocument() {
  const testDoc = {
    title: "Test Medical Document",
    content:
      "This is a test document about cardiovascular health and LDL cholesterol.",
    source: "Test Source",
    categories: ["cardiovascular"],
  };

  return await addDocument(testDoc);
}

// Function to search for documents similar to a query
async function searchDocuments(query, limit = 3) {
  try {
    console.log("Searching for:", query);
    const queryEmbedding = await llmService.generateEmbedding(query);

    const searchQuery = `
        SELECT id, title, content, 1 - (embedding <=> $1) AS similarity
        FROM medical_literature
        ORDER BY similarity DESC
        LIMIT $2
      `;

    const result = await db.query(searchQuery, [queryEmbedding, limit]);
    console.log(`Found ${result.rows.length} relevant documents`);

    return result.rows;
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
}

// Function to perform RAG
async function performRag(query) {
  try {
    // Step 1: Get relevant documents
    const documents = await searchDocuments(query);

    if (documents.length === 0) {
      return {
        response: "I don't have enough information to answer that question.",
        sources: [],
      };
    }

    // Step 2: Format context with better structure
    const context = documents
      .map((doc, index) => {
        return `Document ${index + 1}: ${doc.title}\nContent: ${doc.content}`;
      })
      .join("\n\n");

    // Step 3: Generate response
    const response = await llmService.generateBasicResponse(query, context);

    return {
      response,
      sources: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        similarity: doc.similarity,
      })),
    };
  } catch (error) {
    console.error("Error performing RAG:", error);
    throw error;
  }
}

module.exports = {
  addDocument,
  testAddDocument,
  searchDocuments,
  performRag,
};
