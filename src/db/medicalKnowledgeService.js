const pgConnector = require("./pgConnector");
const llmService = require("./chatService");

// Function to add a simple document to the knowledge base
async function addDocument(document) {
  try {
    const { title, content, source = "Unknown", categories = [] } = document;

    // Generate embedding for the document
    console.log("Generating embedding for document:", title);
    const embedding = await llmService.generateEmbedding(content);

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

    // Only keep results that meet the similarity threshold
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

// Function to perform RAG
async function performRag(query, options = {}) {
  try {
    console.log('🔍 Performing standard RAG');
    
    // Step 1: Get relevant documents with options
    const documents = await searchDocuments(query, options);

    if (documents.length === 0) {
      return {
        response:
          "I don't have enough information to answer that question in my medical knowledge database.",
        sources: [],
      };
    }

    // Step 2: Format context with better structure
    const context = documents
      .map((doc) => {
        return doc.content;
      })
      .join("\n\n");

    // Step 3: Generate response
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
    console.log('🔍 Performing RAG with user context');
    console.log('🔍 User data:', JSON.stringify(userContext?.profile, null, 2));
    
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
      try {
        const directResponse = await llmService.generateBasicResponse(
          query, 
          "", // Empty context - no medical documents
          userContext
        );
        
        const result = {
          response: directResponse,
          sources: [], // No document sources for personal questions
        };
        
        console.log('✅ Personal question result:', { response: result.response?.substring(0, 100) + '...', sources: result.sources.length });
        return result;
        
      } catch (personalError) {
        console.error('❌ Error handling personal question:', personalError);
        return {
          response: "I'm sorry, I couldn't process your personal information request.",
          sources: []
        };
      }
    }
    
    // For non-personal questions, enhance the query with user context and perform regular RAG
    console.log('🔍 Non-personal question - performing enhanced RAG search');
    
    try {
      // Create a contextual query that includes relevant user information
      let contextualQuery = query;
      
      if (userContext?.profile) {
        const { age, sex, familyHistoryDetails, recentLabValues } = userContext.profile;
        
        // Add relevant context to the query
        const contextParts = [];
        if (age && sex) {
          contextParts.push(`Patient is a ${age} year old ${sex?.toLowerCase()}`);
        }
        
        if (familyHistoryDetails && familyHistoryDetails.length > 0) {
          const conditions = familyHistoryDetails.map(fh => fh.condition).join(', ');
          contextParts.push(`Family history includes: ${conditions}`);
        }
        
        if (recentLabValues && Object.keys(recentLabValues).length > 0) {
          const labSummary = Object.entries(recentLabValues)
            .map(([key, value]) => `${key}: ${value.value} ${value.unit}`)
            .join(', ');
          contextParts.push(`Recent lab values: ${labSummary}`);
        }
        
        if (contextParts.length > 0) {
          contextualQuery = `${contextParts.join('. ')}. 
        
Question: ${query}`;
          
          console.log('🔍 Enhanced query with user context:', contextualQuery);
        }
      }
      
      // Use existing RAG logic with enhanced query for non-personal questions
      const result = await performRag(contextualQuery, options);
      console.log('✅ Enhanced RAG result:', { response: result.response?.substring(0, 100) + '...', sources: result.sources.length });
      return result;
      
    } catch (enhancedRagError) {
      console.error('❌ Error performing enhanced RAG:', enhancedRagError);
      // Fallback to regular RAG if context processing fails
      console.log('🔄 Falling back to regular RAG');
      return await performRag(query, options);
    }
    
  } catch (error) {
    console.error("❌ Error performing RAG with context:", error);
    
    // Final fallback - return a basic error response
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