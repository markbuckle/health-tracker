// src/db/pgConnector.js
const { Pool } = require("pg");
const path = require("path");

// Load environment variables from project root
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Detect environment - prioritize local development detection
const isVercel = !!process.env.VERCEL;
const isNodeProduction = process.env.NODE_ENV === 'production';
const postgresUri = process.env.POSTGRES_URI || '';
const hasLocalPostgres = postgresUri.includes('localhost') || postgresUri.includes('127.0.0.1');
const hasDatabaseUrl = !!process.env.DATABASE_URL;

// Check for explicit local development indicators
const isExplicitlyLocal = process.env.NODE_ENV === 'development' || hasLocalPostgres;
const isExplicitlyProduction = isVercel || (isNodeProduction && hasDatabaseUrl);

// Force local if no DATABASE_URL is set (since production should always have DATABASE_URL)
// OR if explicitly local development
const isLocal = isExplicitlyLocal || (!isExplicitlyProduction && !hasDatabaseUrl);
const isProduction = !isLocal;

console.log(`Environment Detection:`);
console.log(`  - VERCEL: ${isVercel}`);
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - POSTGRES_URI: ${postgresUri ? (postgresUri.substring(0, 30) + '...') : 'Not set'}`);
console.log(`  - Has localhost POSTGRES_URI: ${hasLocalPostgres}`);
console.log(`  - Has DATABASE_URL: ${hasDatabaseUrl}`);
console.log(`  - Is explicitly local: ${isExplicitlyLocal}`);
console.log(`  - Is explicitly production: ${isExplicitlyProduction}`);
console.log(`  - Final: ${isProduction ? 'Production' : 'Local Development'}`);

// Configure connection based on environment
let poolConfig;

if (isLocal) {
  // Local development configuration - force localhost
  const localConnectionString = "postgresql://postgres:BroBeans_2317@localhost:5432/postgres";
  
  poolConfig = {
    connectionString: localConnectionString,
    ssl: false,
  };
  console.log('Using local PostgreSQL configuration');
  console.log(`Connection string: ${localConnectionString}`);
} else {
  // Production configuration (Vercel/cloud)
  const productionConnectionString = process.env.DATABASE_URL;
  
  poolConfig = {
    connectionString: productionConnectionString,
    ssl: { rejectUnauthorized: false },
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
  };
  console.log('Using production PostgreSQL configuration');
  console.log(`Connection string: ${productionConnectionString ? 'Set' : 'Not set'}`);
}

// Create connection pool
const pool = new Pool(poolConfig);

// Test the connection (your original method for local, enhanced for production)
if (isLocal) {
  // Original local connection test
  pool.connect((err, client, release) => {
    if (err) {
      console.error("Error connecting to PostgreSQL:", err);
    } else {
      console.log("Connected to PostgreSQL database");
      release();
    }
  });
} else {
  // Production connection test
  pool.connect()
    .then(client => {
      console.log("Connected to PostgreSQL database (production)");
      client.release();
    })
    .catch(err => {
      console.error("Error connecting to PostgreSQL (production):", err);
    });
}

// Helper function for executing queries (enhanced version of your original)
async function query(text, params) {
  const start = Date.now();
  
  try {
    let processedParams = params;
    
    // Your original special handling for vectors (keep this for compatibility)
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
    
    // Add performance logging for production
    if (!isLocal) {
      const duration = Date.now() - start;
      console.log('Executed query', { 
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
        duration, 
        rows: res.rowCount 
      });
    }
    
    return res;
  } catch (err) {
    console.error("Error executing query:", err);
    throw err;
  }
}

// Your original test function, enhanced for both environments
async function testConnection() {
  try {
    const res = await query("SELECT NOW() as current_time");
    return {
      connected: true,
      timestamp: res.rows[0].current_time,
      environment: isLocal ? 'local' : 'production'
    };
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error);
    return {
      connected: false,
      error: error.message,
      environment: isLocal ? 'local' : 'production'
    };
  }
}

// Additional production utilities (only available in production)
const productionUtils = !isLocal ? {
  // Get a client from the pool (for transactions)
  getClient: async () => {
    return await pool.connect();
  },
  
  // Graceful shutdown
  end: async () => {
    await pool.end();
  },
  
  // Pool status
  getPoolStatus: () => {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
  }
} : {};

// Export based on environment
module.exports = {
  query,
  testConnection,
  pool,
  isLocal,
  isProduction,
  ...productionUtils
};