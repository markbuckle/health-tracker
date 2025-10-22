// checkLocalDatabase.js - Debug script to see what's in your local database
const { Pool } = require('pg');
require('dotenv').config();

const localPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function checkDatabase() {
  let client;
  
  try {
    console.log('🔍 Connecting to local database...');
    console.log('Connection string:', process.env.DATABASE_URL?.substring(0, 30) + '...');
    
    client = await localPool.connect();
    console.log('✅ Connected!\n');
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'medical_documents'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Table "medical_documents" does not exist!');
      return;
    }
    
    console.log('✅ Table "medical_documents" exists\n');
    
    // Get total count
    const countResult = await client.query('SELECT COUNT(*) as count FROM medical_documents');
    console.log(`📊 Total documents: ${countResult.rows[0].count}\n`);
    
    // Get all documents with basic info
    const docsResult = await client.query(`
      SELECT 
        id,
        title,
        source,
        categories,
        LENGTH(content) as content_length,
        chunk_index,
        parent_document,
        created_at
      FROM medical_documents
      ORDER BY created_at DESC
    `);
    
    console.log('📚 All documents in database:');
    console.log('='.repeat(80));
    
    docsResult.rows.forEach((doc, index) => {
      console.log(`\n${index + 1}. ${doc.title}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Source: ${doc.source}`);
      console.log(`   Categories: ${doc.categories?.join(', ') || 'none'}`);
      console.log(`   Content length: ${doc.content_length} chars`);
      console.log(`   Chunk: ${doc.chunk_index}, Parent: ${doc.parent_document || 'none'}`);
      console.log(`   Created: ${doc.created_at}`);
    });
    
    console.log('\n' + '='.repeat(80));
    
    // Check for documents by category
    const categoryResult = await client.query(`
      SELECT DISTINCT unnest(categories) as category, COUNT(*) as count
      FROM medical_documents
      WHERE categories IS NOT NULL
      GROUP BY category
      ORDER BY count DESC
    `);
    
    if (categoryResult.rows.length > 0) {
      console.log('\n📊 Documents by category:');
      categoryResult.rows.forEach(row => {
        console.log(`   ${row.category}: ${row.count} documents`);
      });
    }
    
    // Check for documents by source
    const sourceResult = await client.query(`
      SELECT source, COUNT(*) as count
      FROM medical_documents
      GROUP BY source
      ORDER BY count DESC
    `);
    
    if (sourceResult.rows.length > 0) {
      console.log('\n📊 Documents by source:');
      sourceResult.rows.forEach(row => {
        console.log(`   ${row.source || 'Unknown'}: ${row.count} documents`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    if (client) client.release();
    await localPool.end();
  }
}

checkDatabase()
  .then(() => {
    console.log('\n✅ Check completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Check failed:', err);
    process.exit(1);
  });