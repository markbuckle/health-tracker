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

async function performRagWithContext(query, userContext, options = {}) {
  try {
    console.log('🔍 Performing RAG with user context');
    console.log('🔍 User blood type:', userContext?.profile?.bloodType);
    
    // Build contextual prompt
    let contextualQuery = query;
    
    if (userContext && userContext.profile) {
      const contextInfo = [];
      
      if (userContext.profile.age) {
        contextInfo.push(`Patient is ${userContext.profile.age} years old`);
      }
      
      if (userContext.profile.sex) {
        contextInfo.push(`Patient is ${userContext.profile.sex}`);
      }
      
      if (userContext.profile.bloodType) {
        contextInfo.push(`Patient's blood type is ${userContext.profile.bloodType}`);
      }
      
      if (userContext.recentLabValues && Object.keys(userContext.recentLabValues).length > 0) {
        const labInfo = Object.entries(userContext.recentLabValues)
          .slice(0, 3) // Limit to first 3 lab values to avoid overwhelming the prompt
          .map(([test, data]) => `${test}: ${data.value} ${data.unit || ''}`)
          .join(', ');
        contextInfo.push(`Recent lab values: ${labInfo}`);
      }
      
      if (userContext.profile.familyHistory && userContext.profile.familyHistory.length > 0) {
        const validFamilyHistory = userContext.profile.familyHistory.filter(h => h !== null);
        if (validFamilyHistory.length > 0) {
          contextInfo.push(`Family history: ${validFamilyHistory.join(', ')}`);
        }
      }
      
      if (userContext.profile.medications && userContext.profile.medications.length > 0) {
        const validMedications = userContext.profile.medications.filter(m => m !== null);
        if (validMedications.length > 0) {
          contextInfo.push(`Current medications: ${validMedications.join(', ')}`);
        }
      }
      
      // Only add context if we have any meaningful information
      if (contextInfo.length > 0) {
        contextualQuery = `Patient context: ${contextInfo.join('. ')}. 

Question: ${query}`;
        
        console.log('🔍 Enhanced query with user context:', contextualQuery);
      }
    }
    
    // Use existing RAG logic with enhanced query
    return await performRag(contextualQuery, options);
  } catch (error) {
    console.error("❌ Error performing RAG with context:", error);
    // Fallback to regular RAG if context processing fails
    console.log('🔄 Falling back to regular RAG...');
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
