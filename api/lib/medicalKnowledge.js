// lib/medicalKnowledgeService.js
const { query } = require('./pgConnector');
const { generateEmbedding, generateChatResponse } = require('./chatService');

/**
 * Add a document to the knowledge base
 */
async function addDocument(document) {
  try {
    const { title, content, source = "Unknown", categories = [] } = document;

    console.log("Generating embedding for document:", title);
    const embedding = await generateEmbedding(content);

    const text = `
      INSERT INTO medical_documents (
        title, content, source, categories, embedding
      )
      VALUES ($1, $2, $3, $4, $5::vector)
      RETURNING id`;

    const values = [title, content, source, categories, embedding];
    const result = await query(text, values);
    
    console.log(`Document inserted with ID: ${result.rows[0].id}`);
    return result.rows[0].id;
  } catch (error) {
    console.error("Error adding document to knowledge base:", error);
    throw error;
  }
}

/**
 * Search for documents similar to a query
 */
async function searchDocuments(query, options = {}) {
  const { limit = 5, threshold = 0.3, categories = [] } = options;

  try {
    console.log(`Searching for: ${query}`);

    const queryEmbedding = await generateEmbedding(query);

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
    const result = await query(sql, params);
    console.log(`Query returned ${result.rows.length} rows`);

    // Only keep results that meet the similarity threshold
    return result.rows.filter(row => row.similarity >= threshold);
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
}

/**
 * Perform RAG (Retrieval Augmented Generation)
 */
async function performRag(userQuery, options = {}) {
  try {
    console.log("Performing RAG for query:", userQuery);

    // Search for relevant documents
    const documents = await searchDocuments(userQuery, options);

    if (documents.length === 0) {
      return {
        response: "I don't have specific information about that topic in my medical knowledge base. Please try rephrasing your question or ask about cardiovascular health, cholesterol, or other health topics I might be able to help with.",
        sources: []
      };
    }

    // Create context from documents
    const context = documents
      .map(doc => `Source: ${doc.title}\n${doc.content}`)
      .join('\n\n');

    // Generate response using OpenAI
    const messages = [
      {
        role: "system",
        content: `You are a knowledgeable health assistant. Use the provided medical information to answer questions accurately. Always mention that you're not a doctor and users should consult healthcare professionals for medical advice.

Context from medical documents:
${context}`
      },
      {
        role: "user",
        content: userQuery
      }
    ];

    const response = await generateChatResponse(messages);

    return {
      response,
      sources: documents.map(doc => ({
        title: doc.title,
        source: doc.source,
        similarity: doc.similarity
      }))
    };
  } catch (error) {
    console.error("Error performing RAG:", error);
    throw error;
  }
}

/**
 * Perform RAG with user context
 */
async function performRagWithContext(query, userContext, options = {}) {
  try {
    console.log("Performing RAG with user context for query:", query);

    // Handle personal questions about user data
    if (query.toLowerCase().includes('my blood type') || 
        query.toLowerCase().includes('what is my') ||
        query.toLowerCase().includes('my lab') ||
        query.toLowerCase().includes('my result')) {
      
      console.log('Personal question detected - checking user context');
      
      if (!userContext || !userContext.profile) {
        return {
          response: "I don't have access to your personal health information. Please make sure you're logged in and have completed your profile to get personalized responses.",
          sources: []
        };
      }

      // Handle specific personal queries
      if (query.toLowerCase().includes('blood type')) {
        const bloodType = userContext.profile.bloodType;
        if (bloodType && bloodType !== 'Unknown') {
          return {
            response: `According to your profile, your blood type is ${bloodType}.`,
            sources: []
          };
        } else {
          return {
            response: "I don't see your blood type information in your profile. You can add this information in your profile settings.",
            sources: []
          };
        }
      }
    }

    // For non-personal questions, enhance with context and perform regular RAG
    console.log('Non-personal question - performing enhanced RAG search');
    
    let contextualQuery = query;
    
    if (userContext?.profile) {
      const { age, sex, familyHistoryDetails, recentLabValues } = userContext.profile;
      
      const contextParts = [];
      if (age && sex) {
        contextParts.push(`Patient is a ${age} year old ${sex.toLowerCase()}`);
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
        
        console.log('Enhanced query with user context:', contextualQuery);
      }
    }
    
    // Use existing RAG logic with enhanced query
    return await performRag(contextualQuery, options);
  } catch (error) {
    console.error("Error performing RAG with context:", error);
    // Fallback to regular RAG if context processing fails
    return await performRag(query, options);
  }
}

module.exports = {
  addDocument,
  searchDocuments,
  performRag,
  performRagWithContext
};