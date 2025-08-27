const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? 
    { rejectUnauthorized: false } : false
});

async function setupDatabase() {
  try {
    console.log('Setting up database schema...');
    
    // Install pgvector extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('✓ pgvector extension created');
    
    // Create medical_documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS medical_documents (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        categories TEXT[],
        embedding vector(1536),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✓ medical_documents table created');
    
    // Create index for vector similarity search
    await pool.query(`
      CREATE INDEX IF NOT EXISTS medical_documents_embedding_idx 
      ON medical_documents USING ivfflat (embedding vector_cosine_ops) 
      WITH (lists = 100);
    `);
    console.log('✓ Vector index created');
    
    console.log('Database setup complete!');
    
  } catch (error) {
    console.error('Database setup failed:', error);
  } finally {
    await pool.end();
  }
}

setupDatabase();