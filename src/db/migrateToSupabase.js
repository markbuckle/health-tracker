// migrateToSupabase.js - Copy medical documents from local to Supabase using Supabase SDK
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Local database connection
// Use POSTGRES_URI to match your pgConnector.js setup
const localPool = new Pool({
  connectionString: process.env.POSTGRES_URI || process.env.DATABASE_URL,
  ssl: false
});

// Supabase client connection (no password needed!)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', !!supabaseUrl);
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  console.error('\n💡 Get your Service Role Key from:');
  console.error('   Supabase Dashboard > Project Settings > API > service_role key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateDocuments() {
  let localClient;
  
  try {
    console.log('🔍 Connecting to databases...');
    
    // Test local connection
    localClient = await localPool.connect();
    console.log('✅ Connected to local database');
    
    // Test Supabase connection
    const { data: testData, error: testError } = await supabase
      .from('medical_documents')
      .select('count')
      .limit(1);
    
    if (testError && !testError.message.includes('count')) {
      throw new Error(`Supabase connection failed: ${testError.message}`);
    }
    console.log('✅ Connected to Supabase');
    
    // Fetch all documents from local database
    console.log('\n📚 Fetching documents from local database...');
    const localResult = await localClient.query(`
      SELECT 
        title, 
        content, 
        source, 
        categories, 
        embedding,
        original_path,
        chunk_index,
        parent_document,
        section_header,
        content_length,
        is_overlapping,
        images,
        metadata,
        created_at
      FROM medical_documents
      ORDER BY id
    `);
    
    console.log(`📊 Found ${localResult.rows.length} documents in local database`);
    
    if (localResult.rows.length === 0) {
      console.log('❌ No documents found in local database');
      return;
    }
    
    // Display sample document structure
    console.log('\n📋 Sample document structure:');
    const sampleDoc = localResult.rows[0];
    console.log({
      title: sampleDoc.title,
      hasEmbedding: !!sampleDoc.embedding,
      source: sampleDoc.source,
      categories: sampleDoc.categories,
      chunkIndex: sampleDoc.chunk_index,
      contentLength: sampleDoc.content?.length
    });
    
    // Ask for confirmation
    console.log('\n⚠️  This will copy all documents to Supabase.');
    console.log('⚠️  Existing documents with the same title will NOT be duplicated.');
    console.log('\nPress Ctrl+C to cancel, or wait 3 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n📤 Starting migration to Supabase...');
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    // Process in batches to avoid overwhelming Supabase
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < localResult.rows.length; i += BATCH_SIZE) {
      const batch = localResult.rows.slice(i, i + BATCH_SIZE);
      
      for (const doc of batch) {
        try {
          // Check if document already exists in Supabase
          const { data: existing, error: checkError } = await supabase
            .from('medical_documents')
            .select('id')
            .eq('title', doc.title)
            .eq('content', doc.content)
            .limit(1);
          
          if (checkError) {
            throw new Error(`Check failed: ${checkError.message}`);
          }
          
          if (existing && existing.length > 0) {
            console.log(`⏭️  Skipped (exists): ${doc.title}`);
            skipCount++;
            continue;
          }
          
          // Prepare document for insertion
          // Note: Skipping embeddings - they can be regenerated in Supabase
          const docToInsert = {
            title: doc.title,
            content: doc.content,
            source: doc.source,
            categories: doc.categories,
            original_path: doc.original_path,
            chunk_index: doc.chunk_index || 0,
            parent_document: doc.parent_document,
            section_header: doc.section_header,
            content_length: doc.content_length || doc.content?.length,
            is_overlapping: doc.is_overlapping || false,
            images: doc.images || [],
            metadata: doc.metadata || {},
            created_at: doc.created_at || new Date().toISOString()
          };
          
          // Insert document into Supabase
          const { error: insertError } = await supabase
            .from('medical_documents')
            .insert(docToInsert);
          
          if (insertError) {
            throw new Error(`Insert failed: ${insertError.message}`);
          }
          
          successCount++;
          console.log(`✅ Copied [${successCount}/${localResult.rows.length}]: ${doc.title}`);
          
        } catch (error) {
          errorCount++;
          console.error(`❌ Failed to copy "${doc.title}":`, error.message);
        }
      }
      
      // Small delay between batches to avoid rate limits
      if (i + BATCH_SIZE < localResult.rows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 MIGRATION SUMMARY:');
    console.log('='.repeat(50));
    console.log(`✅ Successfully copied: ${successCount} documents`);
    console.log(`⏭️  Skipped (duplicates): ${skipCount} documents`);
    console.log(`❌ Errors: ${errorCount} documents`);
    console.log(`📚 Total processed: ${localResult.rows.length} documents`);
    
    // Verify in Supabase
    const { count: totalCount } = await supabase
      .from('medical_documents')
      .select('*', { count: 'exact', head: true });
    
    console.log(`\n📊 Supabase database now has ${totalCount} total documents`);
    
    // Get stats using RPC call
    const { data: stats, error: statsError } = await supabase
      .rpc('get_document_stats');
    
    if (!statsError && stats && stats.length > 0) {
      console.log('\n📈 Document Statistics:');
      const stat = stats[0];
      console.log(`   - Total documents: ${stat.total_documents}`);
      console.log(`   - With embeddings: ${stat.documents_with_embeddings}`);
      console.log(`   - Unique sources: ${stat.unique_sources}`);
      console.log(`   - Unique categories: ${stat.unique_categories}`);
      console.log(`   - Average content length: ${Math.round(stat.avg_content_length)} chars`);
      console.log(`   - Total chunks: ${stat.total_chunks}`);
      console.log(`   - Unique parent docs: ${stat.unique_parent_docs}`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  } finally {
    // Release local client
    if (localClient) localClient.release();
    
    // Close local pool
    await localPool.end();
  }
}

// Run the migration
if (require.main === module) {
  console.log('🚀 ===== SUPABASE MIGRATION SCRIPT =====\n');
  console.log('This script will copy documents from your local PostgreSQL database');
  console.log('to your Supabase database using the Supabase client SDK.\n');
  
  migrateDocuments()
    .then(() => {
      console.log('\n✨ Migration completed!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n💥 Migration failed:', err);
      process.exit(1);
    });
}

module.exports = { migrateDocuments };