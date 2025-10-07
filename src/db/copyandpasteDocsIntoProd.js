// copyDocuments.js - Copy medical documents from local to production
const { Pool } = require('pg');

// Local database connection
const localPool = new Pool({
  connectionString: "postgresql://postgres:BroBeans_2317@localhost:5432/postgres",
  ssl: false
});

// Production database connection 
const productionPool = new Pool({
  connectionString: process.env.POSTGRES_URI, // Set this environment variable
  ssl: false
});

async function copyDocuments() {
  try {
    console.log('🔍 Fetching documents from local database...');
    
    // Get all documents from local
    const localResult = await localPool.query(`
      SELECT title, content, source, categories, embedding 
      FROM medical_documents
    `);
    
    console.log(`📚 Found ${localResult.rows.length} documents in local database`);
    
    if (localResult.rows.length === 0) {
      console.log('❌ No documents found in local database');
      return;
    }
    
    console.log('📤 Copying documents to production database...');
    
    // Copy each document to production
    let successCount = 0;
    for (const doc of localResult.rows) {
      try {
        await productionPool.query(`
          INSERT INTO medical_documents (title, content, source, categories, embedding)
          VALUES ($1, $2, $3, $4, $5::vector)
        `, [doc.title, doc.content, doc.source, doc.categories, doc.embedding]);
        
        successCount++;
        console.log(`✅ Copied: ${doc.title}`);
      } catch (error) {
        console.error(`❌ Failed to copy ${doc.title}:`, error.message);
      }
    }
    
    console.log(`🎉 Successfully copied ${successCount}/${localResult.rows.length} documents`);
    
    // Verify in production
    const prodResult = await productionPool.query('SELECT COUNT(*) FROM medical_documents');
    console.log(`📊 Production database now has ${prodResult.rows[0].count} documents`);
    
  } catch (error) {
    console.error('❌ Error copying documents:', error);
  } finally {
    await localPool.end();
    await productionPool.end();
  }
}

// Run the copy
copyDocuments()
  .then(() => {
    console.log('✨ Document copy completed!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Copy failed:', error);
    process.exit(1);
  });