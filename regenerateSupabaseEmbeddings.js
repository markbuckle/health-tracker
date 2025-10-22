// regenerateSupabaseEmbeddings.js - Generate embeddings for documents in Supabase
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiApiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

if (!openaiApiKey) {
  console.error('❌ Missing OpenAI API key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const openai = new OpenAI({ apiKey: openaiApiKey });

async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

async function regenerateEmbeddings() {
  try {
    console.log('🔍 Fetching documents without embeddings...');
    
    // Get all documents without embeddings
    const { data: documents, error: fetchError } = await supabase
      .from('medical_documents')
      .select('id, title, content')
      .is('embedding', null);
    
    if (fetchError) {
      throw new Error(`Failed to fetch documents: ${fetchError.message}`);
    }
    
    console.log(`📊 Found ${documents.length} documents without embeddings\n`);
    
    if (documents.length === 0) {
      console.log('✅ All documents already have embeddings!');
      return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      
      try {
        console.log(`[${i + 1}/${documents.length}] Generating embedding for: ${doc.title.substring(0, 60)}...`);
        
        // Generate embedding
        const embedding = await generateEmbedding(doc.content);
        
        // Update document with embedding using RPC function
        const { error: updateError } = await supabase.rpc('update_document_embedding', {
          doc_id: doc.id,
          new_embedding: JSON.stringify(embedding)
        });
        
        if (updateError) {
          throw new Error(`Update failed: ${updateError.message}`);
        }
        
        successCount++;
        console.log(`   ✅ Success`);
        
        // Rate limiting - wait 200ms between requests
        if (i < documents.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
      } catch (error) {
        errorCount++;
        console.error(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 EMBEDDING GENERATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully generated: ${successCount} embeddings`);
    console.log(`❌ Errors: ${errorCount} embeddings`);
    console.log(`📚 Total processed: ${documents.length} documents`);
    
    // Verify final count
    const { count: withEmbeddings } = await supabase
      .from('medical_documents')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null);
    
    const { count: total } = await supabase
      .from('medical_documents')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Final status: ${withEmbeddings}/${total} documents have embeddings`);
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    throw error;
  }
}

// Create the RPC function first
async function createRpcFunction() {
  console.log('🔧 Creating helper function in Supabase...\n');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION update_document_embedding(
        doc_id BIGINT,
        new_embedding TEXT
      )
      RETURNS VOID
      LANGUAGE plpgsql
      AS $$
      BEGIN
        UPDATE medical_documents
        SET embedding = new_embedding::vector
        WHERE id = doc_id;
      END;
      $$;
    `
  }).catch(() => {
    // If exec_sql doesn't exist, we'll need to create the function manually
    console.log('⚠️  Could not auto-create function. Please run this SQL in Supabase SQL Editor:');
    console.log('');
    console.log('CREATE OR REPLACE FUNCTION update_document_embedding(');
    console.log('  doc_id BIGINT,');
    console.log('  new_embedding TEXT');
    console.log(')');
    console.log('RETURNS VOID');
    console.log('LANGUAGE plpgsql');
    console.log('AS $$');
    console.log('BEGIN');
    console.log('  UPDATE medical_documents');
    console.log('  SET embedding = new_embedding::vector');
    console.log('  WHERE id = doc_id;');
    console.log('END;');
    console.log('$$;');
    console.log('');
  });
}

// Run the script
if (require.main === module) {
  console.log('🚀 ===== SUPABASE EMBEDDING REGENERATION =====\n');
  
  regenerateEmbeddings()
    .then(() => {
      console.log('\n✨ Embedding generation completed!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n💥 Generation failed:', err);
      process.exit(1);
    });
}

module.exports = { regenerateEmbeddings };