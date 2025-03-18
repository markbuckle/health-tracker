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
async function searchDocuments(query, options = {}) {
  const { threshold = 0.75, categories = [] } = options;

  try {
    console.log(`Searching for: ${query}`);

    const queryEmbedding = await llmService.generateEmbedding(query);

    let sql = `
      SELECT 
        id, 
        title, 
        content, 
        source,
        categories,
        embedding <=> $1 AS similarity
      FROM medical_documents
      WHERE embedding IS NOT NULL
      AND source = 'Peter Attia MD'  /* Filter specifically for your content */
    `;

    const params = [queryEmbedding];
    let paramIndex = 2;

    // Filter by categories if provided
    if (categories && categories.length > 0) {
      sql += ` AND categories && $${paramIndex}`;
      params.push(categories);
      paramIndex++;
    }

    // Order by similarity and limit results
    sql += ` ORDER BY similarity ASC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pgConnector.query(sql, params);

    // Only keep results that meet the similarity threshold
    const documents = result.rows.filter((row) => row.similarity <= threshold);

    console.log(`Found ${documents.length} relevant documents`);
    return documents;
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
}

// Function to perform RAG
async function performRag(query, options = {}) {
  try {
    // Step 1: Get relevant documents with options
    const documents = await searchDocuments(query, options);

    if (documents.length === 0) {
      return {
        response:
          "I don't have enough information to answer that question in my medical knowledge database.",
        sources: [],
      };
    }

    // Step 2: Format context with better structure and source attribution
    const context = documents
      .map((doc, index) => {
        return `Document ${index + 1} (${doc.title}, Source: ${
          doc.source || "Unknown"
        }): ${doc.content}`;
      })
      .join("\n\n");

    // Step 3: Generate response
    const responseText = await llmService.generateBasicResponse(query, context);

    return {
      response: responseText,
      sources: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source || "Unknown",
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
