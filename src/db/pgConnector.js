// src/db/pgConnector.js - Optimized for serverless cold starts

const { Pool } = require("pg");

const isLocal = process.env.NODE_ENV !== "development";
const isProduction = process.env.NODE_ENV === "production";
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

// Optimized pool configuration for serverless
const poolConfig = {
  connectionString: process.env.POSTGRES_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  
  // Serverless optimizations
  max: isVercel ? 1 : 10,  // Single connection for serverless
  min: 0,                  // No idle connections
  acquireTimeoutMillis: 3000,  // Fail fast
  idleTimeoutMillis: 1000,     // Release quickly
  connectionTimeoutMillis: 3000, // Quick timeout
  
  // Enable keep-alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 0,
  
  // Query timeout for cold starts
  statement_timeout: 5000,
  query_timeout: 5000
};

console.log(`🚀 Database Config: ${isVercel ? 'Vercel Serverless' : isLocal ? 'Local' : 'Production'}`);

// Lazy connection pool (don't connect immediately)
let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool(poolConfig);
    
    // Handle pool errors gracefully
    pool.on('error', (err) => {
      console.error('⚠️ Database pool error:', err.message);
      // Don't exit process in serverless environment
    });
    
    pool.on('connect', () => {
      console.log('✅ Database client connected');
    });
  }
  return pool;
}

// Fast query function with timeout
async function query(text, params) {
  const startTime = Date.now();
  let client = null;
  
  try {
    const currentPool = getPool();
    
    // Get client with timeout
    client = await Promise.race([
      currentPool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      )
    ]);

    // Process vector parameters (keep your existing logic)
    let processedParams = params;
    if (params) {
      processedParams = params.map((param) => {
        if (Array.isArray(param) && param.length > 0 && typeof param[0] === "number") {
          return `[${param.join(",")}]`;
        }
        return param;
      });
    }

    // Execute query with timeout
    const result = await Promise.race([
      client.query(text, processedParams),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout')), 5000)
      )
    ]);
    
    const duration = Date.now() - startTime;
    
    // Log slow queries in production
    if (isProduction && duration > 1000) {
      console.log(`🐌 Slow query: ${duration}ms - ${text.substring(0, 50)}...`);
    }
    
    return result;
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ Query failed after ${duration}ms:`, error.message);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Non-blocking connection test
async function testConnection() {
  try {
    const result = await query("SELECT NOW() as current_time");
    return {
      connected: true,
      timestamp: result.rows[0].current_time,
      environment: isVercel ? 'vercel' : isLocal ? 'local' : 'production'
    };
  } catch (error) {
    console.error('🔥 Connection test failed:', error.message);
    return {
      connected: false,
      error: error.message,
      environment: isVercel ? 'vercel' : isLocal ? 'local' : 'production'
    };
  }
}

// Graceful shutdown for serverless
async function closePool() {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      console.log('💤 Database pool closed');
    } catch (error) {
      console.error('⚠️ Error closing pool:', error.message);
    }
  }
}

// Export optimized functions
module.exports = {
  query,
  testConnection,
  closePool,
  getPool: () => pool,
  isLocal,
  isProduction,
  isVercel
};