// src/db/pgConnector.js - Improved version with better error handling

const { Pool } = require("pg");
require("dotenv").config({ path: "../../.env" });

console.log("Initializing PostgreSQL connection...");
console.log("Environment:", process.env.NODE_ENV);
console.log("Vercel:", !!process.env.VERCEL);

// Enhanced connection configuration
const poolConfig = {
  connectionString: process.env.POSTGRES_URI || 
    "postgresql://postgres:BroBeans_2317@localhost:5432/postgres",
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Connection pool settings for serverless
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000, // Close idle connections after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout after 10 seconds
  allowExitOnIdle: true // Allow the pool to exit when all connections are idle
};

console.log("Connection config:", {
  ssl: poolConfig.ssl,
  max: poolConfig.max,
  host: process.env.POSTGRES_URI ? "configured" : "default"
});

// Create connection pool
const pool = new Pool(poolConfig);

// Enhanced error handling
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err);
});

pool.on('connect', (client) => {
  console.log('New client connected to PostgreSQL');
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

// Test the connection on startup
async function testConnection() {
  try {
    console.log("Testing PostgreSQL connection...");
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as current_time, version() as version');
    console.log("PostgreSQL connection successful!");
    console.log("Server time:", result.rows[0].current_time);
    console.log("PostgreSQL version:", result.rows[0].version.split(' ')[0]);
    client.release();
    return result.rows[0];
  } catch (err) {
    console.error("PostgreSQL connection failed:", err.message);
    console.error("Connection string format:", process.env.POSTGRES_URI ? "provided" : "missing");
    throw err;
  }
}

// Enhanced query function with better error handling
async function query(text, params) {
  const start = Date.now();
  let client;
  
  try {
    // Special handling for vectors (embedding arrays)
    const processedParams = params?.map((param) => {
      if (Array.isArray(param) && param.length > 0 && typeof param[0] === "number") {
        // Convert array of numbers to PostgreSQL vector format [n1,n2,n3,...]
        return `[${param.join(",")}]`;
      }
      return param;
    });

    client = await pool.connect();
    const result = await client.query(text, processedParams || params);
    const duration = Date.now() - start;
    
    console.log("Query executed:", {
      duration: `${duration}ms`,
      rows: result.rowCount,
      command: result.command
    });
    
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    console.error("Query error:", {
      duration: `${duration}ms`,
      error: err.message,
      code: err.code,
      query: text?.substring(0, 100) + "..."
    });
    throw err;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Graceful shutdown for serverless
async function closePool() {
  try {
    await pool.end();
    console.log("PostgreSQL pool closed successfully");
  } catch (err) {
    console.error("Error closing PostgreSQL pool:", err);
  }
}

// For serverless environments, ensure pool closes properly
if (process.env.VERCEL) {
  process.on('beforeExit', closePool);
  process.on('SIGINT', closePool);
  process.on('SIGTERM', closePool);
}

module.exports = {
  query,
  testConnection,
  closePool,
  pool // Export pool for advanced usage
};