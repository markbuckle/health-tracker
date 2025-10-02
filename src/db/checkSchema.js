// src/db/checkSchema.js - ENHANCED VERSION
const db = require("./pgConnector");

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m'
};

function logSection(title) {
  console.log(`\n${colors.bright}${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}${title}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
}

async function checkDatabaseSchema() {
  try {
    logSection("🔍 DATABASE SCHEMA CHECK");

    // ============================================
    // 1. CHECK PGVECTOR EXTENSION
    // ============================================
    console.log(`${colors.cyan}1. Checking pgvector extension...${colors.reset}`);
    const extResult = await db.query(
      "SELECT * FROM pg_extension WHERE extname = 'vector'"
    );

    if (extResult.rows.length === 0) {
      console.log(`   ${colors.red}❌ pgvector extension is NOT installed${colors.reset}`);
      console.log(`   ${colors.yellow}   Run: CREATE EXTENSION vector;${colors.reset}`);
    } else {
      console.log(`   ${colors.green}✅ pgvector extension installed${colors.reset}`);
    }

    // ============================================
    // 2. CHECK TABLE EXISTS
    // ============================================
    console.log(`\n${colors.cyan}2. Checking medical_documents table...${colors.reset}`);
    const tableResult = await db.query(
      "SELECT to_regclass('public.medical_documents')"
    );

    if (!tableResult.rows[0].to_regclass) {
      console.log(`   ${colors.red}❌ medical_documents table doesn't exist!${colors.reset}`);
      return;
    } else {
      console.log(`   ${colors.green}✅ medical_documents table exists${colors.reset}`);
    }

    // ============================================
    // 3. CHECK REQUIRED COLUMNS
    // ============================================
    console.log(`\n${colors.cyan}3. Checking table columns...${colors.reset}`);
    const columnsResult = await db.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'medical_documents'
      ORDER BY ordinal_position
    `);

    const requiredColumns = [
      'id', 'title', 'content', 'source', 'categories', 'embedding',
      'created_at', 'original_path', 'chunk_index', 'parent_document',
      'section_header', 'content_length'
    ];

    const existingColumns = columnsResult.rows.map(row => row.column_name);
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));

    if (missingColumns.length > 0) {
      console.log(`   ${colors.yellow}⚠️  Missing columns: ${missingColumns.join(', ')}${colors.reset}`);
      console.log(`   ${colors.yellow}   Run: psql -d your_database -f src/db/schema-update-enhanced.sql${colors.reset}`);
    } else {
      console.log(`   ${colors.green}✅ All required columns present${colors.reset}`);
    }

    console.log(`\n   ${colors.bright}Table Structure:${colors.reset}`);
    columnsResult.rows.forEach(row => {
      const status = requiredColumns.includes(row.column_name) ? '✓' : ' ';
      console.log(`   ${status} ${row.column_name.padEnd(20)} ${row.data_type}`);
    });

    // ============================================
    // 4. CHECK INDEXES
    // ============================================
    console.log(`\n${colors.cyan}4. Checking indexes...${colors.reset}`);
    const indexesResult = await db.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'medical_documents'
      ORDER BY indexname
    `);

    const requiredIndexes = [
      'idx_medical_documents_embedding_hnsw',  // Vector search
      'idx_medical_documents_content_fts',     // Full-text search (NEW)
      'idx_medical_documents_categories',       // Category filtering
      'idx_medical_documents_source'            // Source filtering
    ];

    const existingIndexes = indexesResult.rows.map(row => row.indexname);
    const missingIndexes = requiredIndexes.filter(idx => !existingIndexes.includes(idx));

    if (missingIndexes.length > 0) {
      console.log(`   ${colors.yellow}⚠️  Missing indexes: ${missingIndexes.join(', ')}${colors.reset}`);
      console.log(`   ${colors.yellow}   These are CRITICAL for hybrid search performance!${colors.reset}`);
      console.log(`   ${colors.yellow}   Run: psql -d your_database -f src/db/schema-update-enhanced.sql${colors.reset}`);
    } else {
      console.log(`   ${colors.green}✅ All critical indexes present${colors.reset}`);
    }

    console.log(`\n   ${colors.bright}Existing Indexes:${colors.reset}`);
    indexesResult.rows.forEach(row => {
      const isCritical = requiredIndexes.includes(row.indexname);
      const marker = isCritical ? '🔥' : '  ';
      console.log(`   ${marker} ${row.indexname}`);
    });

    // ============================================
    // 5. CHECK DOCUMENT STATISTICS
    // ============================================
    console.log(`\n${colors.cyan}5. Checking document statistics...${colors.reset}`);
    
    const countResult = await db.query("SELECT COUNT(*) FROM medical_documents");
    const totalDocs = parseInt(countResult.rows[0].count);
    
    const embeddingResult = await db.query(
      "SELECT COUNT(*) FROM medical_documents WHERE embedding IS NOT NULL"
    );
    const docsWithEmbeddings = parseInt(embeddingResult.rows[0].count);

    const sourcesResult = await db.query(
      "SELECT COUNT(DISTINCT source) FROM medical_documents"
    );
    const uniqueSources = parseInt(sourcesResult.rows[0].count);

    // Fixed: Use subquery to avoid set-returning function in aggregate
    const categoriesResult = await db.query(`
      SELECT COUNT(*) FROM (
        SELECT DISTINCT unnest(categories) FROM medical_documents
      ) AS unique_cats
    `);
    const uniqueCategories = parseInt(categoriesResult.rows[0].count);

    console.log(`   Total Documents: ${colors.bright}${totalDocs}${colors.reset}`);
    console.log(`   With Embeddings: ${colors.bright}${docsWithEmbeddings}${colors.reset} (${totalDocs > 0 ? ((docsWithEmbeddings/totalDocs)*100).toFixed(1) : 0}%)`);
    console.log(`   Unique Sources: ${colors.bright}${uniqueSources}${colors.reset}`);
    console.log(`   Unique Categories: ${colors.bright}${uniqueCategories}${colors.reset}`);

    // Check for chunks
    if (existingColumns.includes('chunk_index')) {
      const chunksResult = await db.query(
        "SELECT COUNT(*) FROM medical_documents WHERE chunk_index > 0"
      );
      const totalChunks = parseInt(chunksResult.rows[0].count);
      console.log(`   Document Chunks: ${colors.bright}${totalChunks}${colors.reset}`);
    }

    // ============================================
    // 6. TEST FULL-TEXT SEARCH
    // ============================================
    console.log(`\n${colors.cyan}6. Testing full-text search capability...${colors.reset}`);
    
    if (totalDocs > 0) {
      try {
        const ftsTestResult = await db.query(`
          SELECT COUNT(*) 
          FROM medical_documents 
          WHERE to_tsvector('english', content) @@ plainto_tsquery('english', 'health')
          LIMIT 1
        `);
        console.log(`   ${colors.green}✅ Full-text search is working${colors.reset}`);
      } catch (error) {
        console.log(`   ${colors.red}❌ Full-text search failed: ${error.message}${colors.reset}`);
        console.log(`   ${colors.yellow}   You need to run the schema update SQL${colors.reset}`);
      }
    } else {
      console.log(`   ${colors.yellow}⚠️  No documents to test (database is empty)${colors.reset}`);
    }

    // ============================================
    // 7. FINAL RECOMMENDATIONS
    // ============================================
    logSection("📋 RECOMMENDATIONS");

    if (missingColumns.length > 0 || missingIndexes.length > 0) {
      console.log(`${colors.yellow}⚠️  ACTION REQUIRED:${colors.reset}`);
      console.log(`\n1. Update your database schema:`);
      console.log(`   ${colors.cyan}psql -d your_database -f src/db/schema-update-enhanced.sql${colors.reset}`);
      console.log(`\n2. Clear old data and re-initialize:`);
      console.log(`   ${colors.cyan}psql -d your_database -c "TRUNCATE TABLE medical_documents RESTART IDENTITY CASCADE;"${colors.reset}`);
      console.log(`   ${colors.cyan}node src/db/initializeDatabase.js${colors.reset}`);
    } else if (totalDocs === 0) {
      console.log(`${colors.yellow}⚠️  Database is empty${colors.reset}`);
      console.log(`\nInitialize your database:`);
      console.log(`   ${colors.cyan}node src/db/initializeDatabase.js${colors.reset}`);
    } else if (docsWithEmbeddings < totalDocs) {
      console.log(`${colors.yellow}⚠️  Some documents missing embeddings${colors.reset}`);
      console.log(`\nRe-initialize to generate embeddings:`);
      console.log(`   ${colors.cyan}node src/db/initializeDatabase.js${colors.reset}`);
    } else {
      console.log(`${colors.green}✅ Everything looks good!${colors.reset}`);
      console.log(`\nReady to test:`);
      console.log(`   ${colors.cyan}node src/db/testPeterAttia.js${colors.reset}`);
    }

    console.log('');

  } catch (error) {
    console.error(`\n${colors.red}❌ Error checking schema:${colors.reset}`, error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  checkDatabaseSchema();
}

module.exports = { checkDatabaseSchema };