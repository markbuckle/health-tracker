// updateLocalSchema.js - Add missing columns to local database
const { Pool } = require('pg');
require('dotenv').config();

const localPool = new Pool({
  connectionString: process.env.POSTGRES_URI || process.env.DATABASE_URL,
  ssl: false
});

async function updateLocalSchema() {
  let client;
  
  try {
    console.log('🔧 Connecting to local database...');
    client = await localPool.connect();
    console.log('✅ Connected!\n');
    
    console.log('📋 Checking existing columns...');
    
    // Get current columns
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'medical_documents'
      ORDER BY ordinal_position
    `);
    
    const existingColumns = columnsResult.rows.map(r => r.column_name);
    console.log('Current columns:', existingColumns.join(', '));
    console.log('');
    
    // Define columns we need
    const requiredColumns = [
      { name: 'images', type: 'JSONB', default: "'[]'::jsonb" },
      { name: 'metadata', type: 'JSONB', default: "'{}'::jsonb" },
      { name: 'original_path', type: 'TEXT', default: 'NULL' },
      { name: 'chunk_index', type: 'INTEGER', default: '0' },
      { name: 'parent_document', type: 'TEXT', default: 'NULL' },
      { name: 'section_header', type: 'TEXT', default: 'NULL' },
      { name: 'content_length', type: 'INTEGER', default: 'NULL' },
      { name: 'is_overlapping', type: 'BOOLEAN', default: 'FALSE' }
    ];
    
    console.log('🔨 Adding missing columns...\n');
    
    for (const col of requiredColumns) {
      if (!existingColumns.includes(col.name)) {
        console.log(`   Adding column: ${col.name} (${col.type})`);
        
        await client.query(`
          ALTER TABLE medical_documents 
          ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.default}
        `);
        
        console.log(`   ✅ Added ${col.name}`);
      } else {
        console.log(`   ⏭️  Column ${col.name} already exists`);
      }
    }
    
    // Update content_length for existing documents
    console.log('\n📏 Updating content_length for existing documents...');
    const updateResult = await client.query(`
      UPDATE medical_documents 
      SET content_length = LENGTH(content)
      WHERE content_length IS NULL
    `);
    console.log(`   ✅ Updated ${updateResult.rowCount} documents`);
    
    // Verify final schema
    console.log('\n📊 Final schema:');
    const finalColumns = await client.query(`
      SELECT 
        column_name, 
        data_type,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'medical_documents'
      ORDER BY ordinal_position
    `);
    
    console.log('='.repeat(70));
    finalColumns.rows.forEach(col => {
      console.log(`${col.column_name.padEnd(20)} | ${col.data_type.padEnd(20)} | ${col.column_default || 'none'}`);
    });
    console.log('='.repeat(70));
    
    console.log('\n✅ Local database schema updated successfully!');
    console.log('\n📋 Next step:');
    console.log('   Run: node migrateToSupabase.js');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  } finally {
    if (client) client.release();
    await localPool.end();
  }
}

updateLocalSchema()
  .then(() => {
    console.log('\n✨ Schema update completed!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Schema update failed:', err);
    process.exit(1);
  });