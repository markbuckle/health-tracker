// src/utilities/supabaseDocumentStorage.js
// Helper function to store user documents in Supabase for RAG

async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: text,
        model: 'text-embedding-ada-002'
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI embedding failed: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

async function storeUserDocumentInSupabase(userId, fileData, extractedData) {
  try {
    console.log('📄 Storing user document in Supabase for RAG...');
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('⚠️ Supabase configuration missing, skipping document storage');
      return null;
    }

    if (!process.env.OPENAI_API_KEY) {
      console.warn('⚠️ OpenAI API key missing, skipping document storage');
      return null;
    }
    
    // Prepare content for embedding and searching
    const labValuesText = extractedData.labValues ? 
      Object.entries(extractedData.labValues)
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? value.value || value : value}`)
        .join(', ') : '';

    const content = `
File: ${fileData.originalName || fileData.filename}
Test Date: ${extractedData.testDate || 'Not specified'}
Lab Values: ${labValuesText}
Raw OCR Text: ${extractedData.rawText || ''}
    `.trim();
    
    console.log('📝 Content prepared for embedding:', content.substring(0, 200) + '...');
    
    // Generate embedding
    console.log('🔮 Generating embedding...');
    const embedding = await generateEmbedding(content);
    
    console.log('✨ Embedding generated successfully, dimensions:', embedding.length);
    
    // Store in user_documents table
    const response = await fetch(`${supabaseUrl}/rest/v1/user_documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: userId.toString(),
        title: `Lab Results - ${fileData.originalName || fileData.filename}`,
        content: content,
        source: `User Upload - ${fileData.originalName || fileData.filename}`,
        categories: ['lab-results', 'user-data'],
        embedding: embedding,
        file_type: fileData.mimetype,
        metadata: {
          original_filename: fileData.originalName || fileData.filename,
          lab_values: extractedData.labValues || {},
          test_date: extractedData.testDate,
          confidence: extractedData.confidence || 0,
          extraction_method: extractedData.provider || 'unknown'
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to store user document: ${response.status} - ${errorText}`);
    }
    
    console.log('✅ User document stored in Supabase successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Error storing user document in Supabase:', error);
    // Don't fail the entire upload process if this fails
    return false;
  }
}

module.exports = {
  storeUserDocumentInSupabase
};