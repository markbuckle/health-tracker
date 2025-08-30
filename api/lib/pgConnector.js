// lib/pgConnector.js - Vercel-optimized version with connection pooling
const { Pool } = require('pg');

// Vercel environment - always production
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('supabase.co') ? 
    { rejectUnauthorized: false } : false,
  max: 1, // Single connection for serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// Cache the pool to reuse across function invocations
let cachedPool = null;

function getPool() {
  if (!cachedPool) {
    cachedPool = new Pool(poolConfig);
    console.log('Created new database pool');
  }
  return cachedPool;
}

// Enhanced query helper function optimized for Vercel with cached pool
async function query(text, params) {
  const start = Date.now();
  const pool = getPool(); // Use cached pool
  
  try {
    let processedParams = params;
    
    // Special handling for vectors (for pgvector/RAG functionality)
    if (params) {
      processedParams = params.map((param) => {
        if (
          Array.isArray(param) &&
          param.length > 0 &&
          typeof param[0] === "number"
        ) {
          // Convert array of numbers to PostgreSQL vector format
          return `[${param.join(",")}]`;
        }
        return param;
      });
    }

    const res = await pool.query(text, processedParams);
    
    const duration = Date.now() - start;
    
    // Performance logging for slow queries
    if (duration > 1000) {
      console.log('Slow query detected:', {
        duration: `${duration}ms`,
        rows: res.rowCount
      });
    }
    
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error("Query execution error:", {
      message: err.message,
      duration: `${duration}ms`
    });
    throw err;
  }
}

// Health check function using cached pool
async function healthCheck() {
  try {
    const pool = getPool(); // Use cached pool
    const result = await pool.query('SELECT NOW() as timestamp, 1 as status');
    return {
      status: 'healthy',
      timestamp: result.rows[0].timestamp,
      database: 'connected'
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      database: 'disconnected'
    };
  }
}

module.exports = {
  query,
  healthCheck
};