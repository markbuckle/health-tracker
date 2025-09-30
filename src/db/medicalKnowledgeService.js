// src/db/medicalKnowledgeService.js - FIXED VERSION
const pgConnector = require("./pgConnector");
const llmService = require("./chatService");

async function addDocument(document) {
  try {
    const { title, content, source = "Unknown", categories = [] } = document;

    console.log("Generating embedding for document:", title);
    const embedding = await llmService.generateEmbedding(content);

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

async function testAddDocument() {
  const testDoc = {
    title: "Test Medical Document",
    content: "This is a test document about cardiovascular health and LDL cholesterol.",
    source: "Test Source",
    categories: ["cardiovascular"],
  };

  return await addDocument(testDoc);
}

async function searchDocuments(query, options = {}) {
  const { limit = 5, threshold = 0.5, categories = [] } = options;

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

    if (categories && categories.length > 0) {
      sql += ` AND categories && $${paramIndex}`;
      params.push(categories);
      paramIndex++;
    }

    sql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
    params.push(limit);

    console.log("Executing SQL query...");
    const startTime = Date.now();
    const result = await pgConnector.query(sql, params);
    const elapsed = Date.now() - startTime;
    console.log(`✅ Query completed in ${elapsed}ms, returned ${result.rows.length} rows`);

    const documents = result.rows.filter((row) => row.similarity >= threshold);

    console.log(`Found ${documents.length} relevant documents`);
    console.log(
      "Documents:",
      documents.map((d) => ({
        id: d.id,
        title: d.title,
        similarity: d.similarity,
      }))
    );

    return documents;
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
}

async function performRag(query, options = {}) {
  try {
    console.log('🔍 Performing standard RAG');
    
     // Change default limit from 5 to 1 for focused answers
    const searchOptions = { 
      limit: options.limit || 1,  // Changed from 5 to 1
      threshold: options.threshold || 0.5 
    };
    const documents = await searchDocuments(query, searchOptions);

    if (documents.length === 0) {
      return {
        response: "I don't have information about that topic in my medical knowledge database.",
        sources: [],
      };
    }

    const context = documents.map((doc) => doc.content).join("\n\n");

    console.log('🔍 Generating response with context length:', context.length);
    const responseText = await llmService.generateBasicResponse(query, context);

    const result = {
      response: responseText,
      sources: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source || "Unknown",
        similarity: doc.similarity,
      })),
    };

    console.log('✅ RAG result:', { response: result.response?.substring(0, 100) + '...', sources: result.sources.length });
    return result;
    
  } catch (error) {
    console.error("❌ Error performing RAG:", error);
    throw error;
  }
}

async function performRagWithContext(query, userContext, options = {}) {
  try {
    console.log('\n🔍 ===== PERFORMING RAG WITH USER CONTEXT =====');
    console.log('🔍 Query:', query);
    console.log('🔍 User context provided:', !!userContext);
    
    // Check if this is a personal question
    const isPersonalQuestion = llmService.isPersonalHealthQuestion 
      ? llmService.isPersonalHealthQuestion(query)
      : false;
    
    console.log('🔍 Is personal question:', isPersonalQuestion);
    
    // ==========================================
    // PERSONAL QUESTIONS: Answer directly with user data, NO document search
    // ==========================================
    if (isPersonalQuestion && userContext) {
      console.log('🎯 Personal question detected - using direct user data, NO document search');
      
      try {
        const directResponse = await llmService.generateBasicResponse(
          query, 
          "", // Empty context - no medical documents needed
          userContext
        );
        
        return {
          response: directResponse,
          sources: [], // No document sources for personal questions
        };
        
      } catch (personalError) {
        console.error('❌ Error handling personal question:', personalError);
        return {
          response: "I'm sorry, I couldn't process your personal information request.",
          sources: []
        };
      }
    }
    
    // ==========================================
    // GENERAL QUESTIONS: Use standard RAG WITHOUT modifying the query
    // ==========================================
    console.log('📚 Non-personal question - performing standard RAG');
    console.log('🚨 CRITICAL: NOT adding user context to query - keeping query as-is');
    
    // Just pass the original query through to standard RAG
    // Do NOT enhance or modify it with user context
    const result = await performRag(query, options);
    
    console.log('✅ Standard RAG result:', { 
      response: result.response?.substring(0, 100) + '...', 
      sources: result.sources.length 
    });
    
    return result;
    
  } catch (error) {
    console.error("❌ Error performing RAG with context:", error);
    
    try {
      return await performRag(query, options);
    } catch (fallbackError) {
      console.error("❌ Even fallback RAG failed:", fallbackError);
      return {
        response: "I'm sorry, I encountered an error while processing your question. Please try again.",
        sources: []
      };
    }
  }
}

module.exports = {
  addDocument,
  testAddDocument,
  searchDocuments,
  performRag,
  performRagWithContext
};