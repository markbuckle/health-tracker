// src/db/medicalKnowledgeService.js - ENHANCED WITH ALL IMPROVEMENTS
const pgConnector = require("./pgConnector");
const llmService = require("./chatService");

// ============================================
// PRIORITY 1: QUERY ENHANCEMENT
// ============================================

async function enhanceQuery(query) {
  // Expand medical abbreviations and add synonyms
  const expansions = {
    'ldl': 'LDL low-density lipoprotein cholesterol bad cholesterol',
    'hdl': 'HDL high-density lipoprotein cholesterol good cholesterol',
    'bp': 'blood pressure hypertension',
    'vo2': 'VO2 max oxygen uptake aerobic capacity',
    'ascvd': 'atherosclerotic cardiovascular disease heart disease',
    'cvd': 'cardiovascular disease heart disease coronary',
    'dm': 'diabetes mellitus blood sugar glucose',
    'bmi': 'body mass index weight obesity',
    'a1c': 'hemoglobin A1c glycated hemoglobin diabetes',
    'tg': 'triglycerides triacylglycerol fat',
    'chol': 'cholesterol lipid'
  };
  
  let enhanced = query;
  for (const [abbrev, full] of Object.entries(expansions)) {
    const regex = new RegExp(`\\b${abbrev}\\b`, 'gi');
    if (regex.test(query)) {
      enhanced += ` ${full}`;
    }
  }
  
  console.log(`📝 Query Enhancement:\n   Original: ${query}\n   Enhanced: ${enhanced}`);
  return enhanced;
}

// ============================================
// PRIORITY 5: CATEGORY DETECTION
// ============================================

function detectQueryCategories(query) {
  const categoryKeywords = {
    cardiovascular: ['heart', 'cholesterol', 'ldl', 'hdl', 'cardiovascular', 'cardiac', 'ascvd', 'cvd', 'atherosclerosis', 'arterial', 'coronary'],
    exercise: ['exercise', 'vo2', 'fitness', 'workout', 'training', 'physical activity', 'aerobic', 'strength'],
    oncology: ['cancer', 'tumor', 'oncology', 'malignancy', 'chemotherapy'],
    nutrition: ['diet', 'food', 'nutrition', 'eating', 'meal', 'calorie', 'macronutrient'],
    metabolic: ['diabetes', 'insulin', 'glucose', 'metabolic', 'blood sugar', 'a1c'],
    longevity: ['longevity', 'aging', 'lifespan', 'mortality', 'centenarian', 'death', 'causes of death']
  };
  
  const detected = [];
  const lowerQuery = query.toLowerCase();
  
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some(kw => lowerQuery.includes(kw))) {
      detected.push(category);
    }
  }
  
  if (detected.length > 0) {
    console.log(`🏷️  Detected categories: ${detected.join(', ')}`);
  }
  
  return detected;
}

// ============================================
// CORE DOCUMENT MANAGEMENT
// ============================================

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

// ============================================
// PRIORITY 3: HYBRID SEARCH
// ============================================

async function hybridSearch(query, options = {}) {
  const { limit = 10, threshold = 0.3, categories = [] } = options;
  
  try {
    // Enhanced query for better matching
    const enhancedQuery = await enhanceQuery(query);
    
    // Vector search with enhanced query
    const queryEmbedding = await llmService.generateEmbedding(enhancedQuery);
    
    let vectorSql = `
      SELECT id, title, content, source, categories, 
             1 - (embedding <=> $1) AS similarity
      FROM medical_documents
      WHERE embedding IS NOT NULL
    `;
    
    const vectorParams = [queryEmbedding];
    let paramIndex = 2;
    
    if (categories && categories.length > 0) {
      vectorSql += ` AND categories && $${paramIndex}`;
      vectorParams.push(categories);
      paramIndex++;
    }
    
    vectorSql += ` ORDER BY similarity DESC LIMIT $${paramIndex}`;
    vectorParams.push(limit);
    
    console.log("🔍 Executing vector search...");
    const vectorResult = await pgConnector.query(vectorSql, vectorParams);
    
    // Keyword search (BM25-style with PostgreSQL full-text search)
    let keywordSql = `
      SELECT id, title, content, source, categories,
             ts_rank(to_tsvector('english', content), plainto_tsquery('english', $1)) as keyword_score
      FROM medical_documents
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
    `;
    
    const keywordParams = [query];
    let kwParamIndex = 2;
    
    if (categories && categories.length > 0) {
      keywordSql += ` AND categories && $${kwParamIndex}`;
      keywordParams.push(categories);
      kwParamIndex++;
    }
    
    keywordSql += ` ORDER BY keyword_score DESC LIMIT $${kwParamIndex}`;
    keywordParams.push(limit);
    
    console.log("🔍 Executing keyword search...");
    const keywordResult = await pgConnector.query(keywordSql, keywordParams);
    
    // Combine results using Reciprocal Rank Fusion (RRF)
    const combined = new Map();
    
    // Add vector results
    vectorResult.rows.forEach(doc => {
      combined.set(doc.id, {
        ...doc,
        vector_score: doc.similarity || 0,
        keyword_score: 0
      });
    });
    
    // Merge keyword results
    keywordResult.rows.forEach(doc => {
      if (combined.has(doc.id)) {
        combined.get(doc.id).keyword_score = doc.keyword_score;
      } else {
        combined.set(doc.id, {
          ...doc,
          similarity: 0,
          vector_score: 0,
          keyword_score: doc.keyword_score
        });
      }
    });
    
    // Calculate hybrid scores (weighted combination)
    const hybridResults = Array.from(combined.values())
      .map(doc => ({
        ...doc,
        hybrid_score: (doc.vector_score * 0.7) + (doc.keyword_score * 0.3),
        // Bonus for title matches
        title_bonus: doc.title.toLowerCase().includes(query.toLowerCase()) ? 0.1 : 0
      }))
      .map(doc => ({
        ...doc,
        final_score: doc.hybrid_score + doc.title_bonus
      }))
      .filter(doc => doc.final_score >= threshold)
      .sort((a, b) => b.final_score - a.final_score)
      .slice(0, limit);
    
    console.log(`✅ Hybrid search found ${hybridResults.length} documents`);
    
    return hybridResults;
    
  } catch (error) {
    console.error("Error in hybrid search:", error);
    // Fallback to simple vector search if hybrid fails
    console.log("⚠️  Falling back to vector-only search");
    return await searchDocuments(query, options);
  }
}

// ============================================
// STANDARD VECTOR SEARCH (Fallback)
// ============================================

async function searchDocuments(query, options = {}) {
  const { limit = 10, threshold = 0.3, categories = [] } = options;

  try {
    console.log(`🔍 Searching for: ${query}`);

    // Enhance query
    const enhancedQuery = await enhanceQuery(query);
    const queryEmbedding = await llmService.generateEmbedding(enhancedQuery);

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

    const result = await pgConnector.query(sql, params);
    const documents = result.rows.filter((row) => row.similarity >= threshold);

    console.log(`✅ Found ${documents.length} relevant documents`);
    return documents;
    
  } catch (error) {
    console.error("Error searching documents:", error);
    throw error;
  }
}

// ============================================
// PRIORITY 2: IMPROVED RAG WITH RE-RANKING
// ============================================

async function performRag(query, options = {}, userContext = null, conversationHistory = []) {
  try {
    console.log('🔍 ===== PERFORMING ENHANCED RAG =====');
    console.log('🔍 Query:', query);
    console.log('🔍 performRag received conversationHistory:', conversationHistory?.length || 'undefined');
    
    // Detect categories from query
    const detectedCategories = detectQueryCategories(query);
    
    // Use hybrid search with category filtering
    const searchOptions = { 
      limit: options.limit || 10,  // Retrieve more initially
      threshold: options.threshold || 0.3,  // Lower threshold
      categories: detectedCategories.length > 0 ? detectedCategories : options.categories || []
    };
    
    // Use hybrid search for better results
    const allDocuments = await hybridSearch(query, searchOptions);

    if (allDocuments.length === 0) {
      return {
        response: "I don't have information about that topic in my medical knowledge database.",
        sources: [],
      };
    }

    // Re-rank documents by relevance
    const reranked = allDocuments
      .map(doc => ({
        ...doc,
        // Additional scoring factors
        titleRelevance: doc.title.toLowerCase().includes(query.toLowerCase()) ? 0.15 : 0,
        lengthScore: doc.content.length > 500 && doc.content.length < 5000 ? 0.05 : 0,
        finalScore: (doc.final_score || doc.similarity) + 
                   (doc.title.toLowerCase().includes(query.toLowerCase()) ? 0.15 : 0) +
                   (doc.content.length > 500 && doc.content.length < 5000 ? 0.05 : 0)
      }))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, 3);  // Take top 3 after re-ranking
    
    console.log(`📊 Re-ranked to top ${reranked.length} documents`);

    // Combine context from top documents
    const context = reranked.map((doc) => doc.content).join("\n\n");

    console.log('🔍 Generating response with context length:', context.length);
    const responseText = await llmService.generateBasicResponse(query, context, userContext, conversationHistory);

    const result = {
      response: responseText,
      sources: reranked.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source: doc.source || "Unknown",
        similarity: doc.similarity || doc.final_score,
        score: doc.finalScore
      })),
    };

    console.log('✅ RAG complete:', { 
      responseLength: result.response?.length, 
      sourcesCount: result.sources.length 
    });
    
    return result;
    
  } catch (error) {
    console.error("❌ Error performing RAG:", error);
    throw error;
  }
}

// ============================================
// RAG WITH USER CONTEXT (for personal questions)
// ============================================

async function performRagWithContext(query, userContext, conversationHistory = [], options = {}) {
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
    // PERSONAL QUESTIONS: Answer directly with user data
    // ==========================================
    if (isPersonalQuestion && userContext) {
      console.log('🎯 Personal question detected - using direct user data');
      
      try {
        const directResponse = await llmService.generateBasicResponse(
          query, 
          "", // Empty context - no medical documents needed
          userContext,
          conversationHistory
        );
        
        return {
          response: directResponse,
          sources: [], // No document sources for personal questions
        };
        
      } catch (personalError) {
        console.error('❌ Error handling personal question:', personalError);
        return {
          response: "I'm sorry, I couldn't process your personal information request.",
          sources: [],
        };
      }
    }
    
    // ==========================================
    // GENERAL QUESTIONS: Use enhanced RAG with user context
    // ==========================================
    console.log('📚 General medical question - using enhanced RAG');
    
    const ragResult = await performRag(query, options, userContext, conversationHistory);
    
    // If user context exists, optionally personalize the response
    if (userContext && ragResult.response) {
      console.log('💡 Adding personalized context to general response');
      // The response is already generated, we keep it as-is
      // User context can be used in future for more personalization
    }
    
    return ragResult;
    
  } catch (error) {
    console.error("❌ Error performing RAG with context:", error);
    throw error;
  }
}

// ============================================
// TEST FUNCTION
// ============================================

async function testAddDocument() {
  const testDoc = {
    title: "Test Medical Document",
    content: "This is a test document about cardiovascular health and LDL cholesterol.",
    source: "Test Source",
    categories: ["cardiovascular"],
  };

  return await addDocument(testDoc);
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  addDocument,
  searchDocuments,
  hybridSearch,
  performRag,
  performRagWithContext,
  testAddDocument,
  enhanceQuery,
  detectQueryCategories
};

console.log('✅ medicalKnowledgeService.js loaded with enhanced RAG capabilities');