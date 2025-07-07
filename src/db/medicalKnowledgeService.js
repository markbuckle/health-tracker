const pgConnector = require("./pgConnector");
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
      INSERT INTO medical_documents (
        title, content, source, categories, embedding
      )
      VALUES ($1, $2, $3, $4, $5::vector)
      RETURNING id`;

    const values = [title, content, source, categories, embedding];

    const result = await pgConnector.query(text, values);
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
  const { limit = 5, threshold = 0.3, categories = [] } = options;

  try {
    console.log(`Searching for: ${query}`);

    const queryEmbedding = await llmService.generateEmbedding(query);

    let sql = `
      SELECT id, title, content, source, categories, 
            1 - (embedding <=> $1) AS similarity
      FROM medical_documents
      WHERE embedding IS NOT NULL
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
    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
    params.push(limit);

    console.log("Executing SQL query:", sql);
    const result = await pgConnector.query(sql, params);
    console.log(`Query returned ${result.rows.length} rows`);

    // Only keep results that meet the similarity threshold. Lower threshold is better for vector similarity
    const documents = result.rows.filter((row) => row.similarity >= threshold); // Change <= to >= since DESC

    console.log(`Found ${documents.length} relevant documents`);
    console.log(
      "Documents:",
      documents.map((d) => ({
        id: d.id,
        title: d.title,
        similarity: d.similarity,
      }))
    );

    console.log(
      "Raw similarity scores:",
      result.rows.map((row) => ({
        title: row.title,
        similarity: row.similarity,
      }))
    );

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
      .map((doc) => {
        return doc.content;
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

async function performRagWithContext(query, userContext, options = {}) {
  try {
    console.log('🔍 Performing RAG with user context');
    console.log('🔍 User data:', JSON.stringify(userContext.profile, null, 2));
    
    // Expanded personal question detection
    const personalQuestionPatterns = [
      'my blood type', 'what is my', 'what is the user', 'blood type',
      'how old am i', 'my age', 'what age am i', 'how old is the user',
      'my sex', 'my gender', 'what sex am i', 'what gender am i',
      'my medications', 'what medications', 'my meds', 'what meds',
      'my family history', 'family history', 'my lifestyle', 'my health history',
      'my lab values', 'my lab results', 'my recent labs', 'my test results'
    ];
    
    const queryLower = query.toLowerCase();
    const isPersonalQuestion = personalQuestionPatterns.some(pattern => 
      queryLower.includes(pattern)
    );
    
    console.log('🔍 Query:', query);
    console.log('🔍 Is personal question:', isPersonalQuestion);
    
    if (isPersonalQuestion) {
      console.log('🎯 Personal question detected - bypassing document search');
      
      // For personal questions, answer directly without searching documents
      const directResponse = await llmService.generateBasicResponse(
        query, 
        "", // Empty context - no medical documents
        userContext
      );
      
      return {
        response: directResponse,
        sources: [], // No document sources for personal questions
      };
    }
    
    // ... rest of your existing function for non-personal questions
  } catch (error) {
    console.error("❌ Error performing RAG with context:", error);
    return await performRag(query, options);
  }
}

module.exports = {
  addDocument,
  testAddDocument,
  searchDocuments,
  performRag,
  performRagWithContext
};
