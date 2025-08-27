const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.PRODUCTION_POSTGRES_URI;

console.log('Testing connection to:', connectionString.substring(0, 30) + '...');

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('✅ Connected successfully');
    
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log('Database time:', result.rows[0].current_time);
    console.log('PostgreSQL version:', result.rows[0].version.split(' ')[0]);
    
    // Test if medical_documents table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'medical_documents'
      );
    `);
    console.log('medical_documents table exists:', tableCheck.rows[0].exists);
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();