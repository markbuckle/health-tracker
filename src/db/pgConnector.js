// src/db/pgConnector.js - FIXED VERSION
const { Pool } = require("pg");
require('dotenv').config();

// CORRECT environment detection
const isLocal = process.env.NODE_ENV === "development";  // ✅ FIXED!
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

console.log('🔍 Environment Detection:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('isLocal:', isLocal);
console.log('isProduction:', isProduction);
console.log('isVercel:', isVercel);

// Get the correct connection string
let connectionString;

if (isLocal) {
  // Local development - use POSTGRES_URI
  connectionString = process.env.POSTGRES_URI;
  console.log('📍 Using LOCAL configuration');
  console.log('Connection string source: POSTGRES_URI');
} else {
  // Production - try multiple options
  connectionString = process.env.POSTGRES_URI || 
                   process.env.POSTGRES_URL || 
                   process.env.DATABASE_URL;
  console.log('📍 Using PRODUCTION configuration');
  console.log('Connection string source:', 
    process.env.POSTGRES_URI ? 'POSTGRES_URI' :
    process.env.POSTGRES_URL ? 'POSTGRES_URL' : 
    process.env.DATABASE_URL ? 'DATABASE_URL' : 'NONE FOUND');
}

if (!connectionString) {
  console.error('❌ No PostgreSQL connection string found!');
  console.error('Available env vars:');
  console.error('- POSTGRES_URI:', !!process.env.POSTGRES_URI);
  console.error('- POSTGRES_URL:', !!process.env.POSTGRES_URL);
  console.error('- DATABASE_URL:', !!process.env.DATABASE_URL);
  throw new Error('PostgreSQL connection string not configured');
}

console.log('✅ Using connection string:', connectionString.substring(0, 30) + '...');

// Optimized pool configuration
const poolConfig = {
  connectionString: connectionString,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  
  // Connection pool settings
  max: isVercel ? 1 : 10,  // Single connection for serverless
  min: 0,                  // No idle connections
  acquireTimeoutMillis: 3000,  // Fail fast
  idleTimeoutMillis: isVercel ? 1000 : 30000,     // Release quickly in serverless
  connectionTimeoutMillis: 3000, // Quick timeout
  
  // Enable keep-alive for better performance
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  
  // Query timeout
  statement_timeout: 10000,
  query_timeout: 10000
};

// Create connection pool
const pool = new Pool(poolConfig);

// Test connection on startup
async function initializeConnection() {
  try {
    const client = await pool.connect();
    console.log(`✅ Connected to PostgreSQL database`);
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`📊 Database time: ${result.rows[0].current_time}`);
    console.log(`📊 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    client.release();
    return true;
  } catch (err) {
    console.error("❌ Error connecting to PostgreSQL:", err.message);
    
    // Provide helpful error messages
    if (err.code === 'ECONNREFUSED') {
      console.error('💡 Connection refused - check if PostgreSQL is running');
    } else if (err.code === 'ENOTFOUND') {
      console.error('💡 Host not found - check your connection string hostname');
    } else if (err.message.includes('password')) {
      console.error('💡 Authentication failed - check username/password');
    } else if (err.message.includes('SASL')) {
      console.error('💡 Password authentication error - check password format');
    }
    
    console.error('💡 Current connection string start:', connectionString.substring(0, 50) + '...');
    return false;
  }
}

// Initialize connection on startup
initializeConnection();

// Helper function for executing queries
async function query(text, params) {
  const start = Date.now();
  
  try {
    let processedParams = params;
    
    // Special handling for vectors (for pgvector)
    if (params) {
      processedParams = params.map((param) => {
        if (
          Array.isArray(param) &&
          param.length > 0 &&
          typeof param[0] === "number"
        ) {
          // Convert array of numbers to PostgreSQL vector format [n1,n2,n3,...]
          return `[${param.join(",")}]`;
        }
        return param;
      });
    }

    const res = await pool.query(text, processedParams);
    
    const duration = Date.now() - start;
    console.log(`✅ Query completed in ${duration}ms, returned ${res.rowCount} rows`);
    
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error(`❌ Query failed after ${duration}ms:`, err.message);
    console.error("Query:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    throw err;
  }
}

// Test function
async function testConnection() {
  try {
    const res = await query("SELECT NOW() as current_time, current_database() as db_name");
    return {
      connected: true,
      timestamp: res.rows[0].current_time,
      database: res.rows[0].db_name,
      environment: isLocal ? 'local' : 'production'
    };
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error.message);
    return {
      connected: false,
      error: error.message,
      environment: isLocal ? 'local' : 'production'
    };
  }
}

// Graceful shutdown
async function closePool() {
  if (pool) {
    try {
      await pool.end();
      console.log('💤 Database pool closed');
    } catch (error) {
      console.error('⚠️ Error closing pool:', error.message);
    }
  }
}

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing database connections...');
  await closePool();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing database connections...');
  await closePool();
  process.exit(0);
});

module.exports = {
  query,
  testConnection,
  closePool,
  pool,
  isLocal,
  isProduction,
  isVercel
};