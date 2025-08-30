// lib/pgConnector.js - Vercel-optimized version
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

const pool = new Pool(poolConfig);

// Enhanced query helper function optimized for Vercel
async function query(text, params) {
  const start = Date.now();
  
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

// Health check function
async function healthCheck() {
  try {
    const result = await query('SELECT NOW() as timestamp, 1 as status');
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