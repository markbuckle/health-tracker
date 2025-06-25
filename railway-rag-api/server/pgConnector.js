// src/db/pgConnector.js
const { Pool } = require("pg");
const path = require("path");

// Load environment variables from project root
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Environment detection for all four environments
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY || process.env.RAILWAY_ENVIRONMENT_NAME;
const isNodeProduction = process.env.NODE_ENV === 'production';
const isExplicitLocal = process.env.EXPLICIT_LOCAL === 'true';

// Check available connection strings
const postgresUri = process.env.POSTGRES_URI || process.env.POSTGRES_URL;
const databaseUrl = process.env.DATABASE_URL;
const hasLocalPostgres = postgresUri && postgresUri.includes('localhost');
const hasDatabaseUrl = !!databaseUrl;
const hasPostgresUri = !!postgresUri;

// Determine if we're in local development
const isLocal = !isVercel && !isRailway && !isNodeProduction && !isExplicitLocal && !hasPostgresUri;

// Determine if we're in production (any production environment)
const isProduction = isVercel || isRailway || isNodeProduction || hasPostgresUri || !isLocal;

console.log(`Environment Detection:`);
console.log(`  - VERCEL: ${!!isVercel}`);
console.log(`  - RAILWAY: ${!!isRailway}`);
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - POSTGRES_URI: ${postgresUri ? (postgresUri.substring(0, 30) + '...') : 'Not set'}`);
console.log(`  - DATABASE_URL: ${databaseUrl ? (databaseUrl.substring(0, 30) + '...') : 'Not set'}`);
console.log(`  - Has localhost POSTGRES_URI: ${hasLocalPostgres}`);
console.log(`  - Has DATABASE_URL: ${hasDatabaseUrl}`);
console.log(`  - Is explicitly local: ${isExplicitLocal}`);
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
  // Production configuration (Vercel/Railway/Digital Ocean)
  // Try multiple environment variables in order of preference
  const productionConnectionString = 
    process.env.POSTGRES_URI ||     // Your current setup
    process.env.POSTGRES_URL ||     // Railway standard
    process.env.DATABASE_URL ||     // Vercel/Heroku standard
    process.env.DB_URL;             // Alternative
  
  if (!productionConnectionString) {
    console.error('❌ No production database connection string found!');
    console.error('Expected one of: POSTGRES_URI, POSTGRES_URL, DATABASE_URL, DB_URL');
    throw new Error('Production database connection string not configured');
  }
  
  poolConfig = {
    connectionString: productionConnectionString,
    ssl: { rejectUnauthorized: false },
    max: 10, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Increased timeout for slower connections
  };
  console.log('Using production PostgreSQL configuration');
  console.log(`Connection string: ${productionConnectionString.substring(0, 30)}...`);
  
  // Log which environment we detected
  if (isVercel) console.log('📍 Detected: Vercel environment');
  if (isRailway) console.log('📍 Detected: Railway environment');
  if (!isVercel && !isRailway && isNodeProduction) console.log('📍 Detected: Generic production environment (Digital Ocean?)');
}

// Create connection pool
const pool = new Pool(poolConfig);

// Enhanced connection test for all environments
async function initializeConnection() {
  try {
    const client = await pool.connect();
    console.log(`✅ Connected to PostgreSQL database (${isProduction ? 'production' : 'local'})`);
    
    // Test basic query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`📊 Database time: ${result.rows[0].current_time}`);
    console.log(`📊 PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]}`);
    
    client.release();
    return true;
  } catch (err) {
    console.error("❌ Error connecting to PostgreSQL:", err.message);
    
    // Provide helpful error messages based on error type
    if (err.code === 'ECONNREFUSED') {
      console.error('💡 Connection refused - check if PostgreSQL is running and accessible');
    } else if (err.code === 'ENOTFOUND') {
      console.error('💡 Host not found - check your connection string hostname');
    } else if (err.code === 'ECONNRESET') {
      console.error('💡 Connection reset - check SSL settings and firewall rules');
    } else if (err.message.includes('password')) {
      console.error('💡 Authentication failed - check username/password in connection string');
    }
    
    return false;
  }
}

// Initialize connection on startup
initializeConnection();

// Helper function for executing queries (enhanced version)
async function query(text, params) {
  const start = Date.now();
  
  try {
    let processedParams = params;
    
    // Special handling for vectors (keep for compatibility)
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
    if (isProduction) {
      const duration = Date.now() - start;
      if (duration > 1000) { // Only log slow queries
        console.log('🐌 Slow query detected', { 
          text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
          duration: `${duration}ms`, 
          rows: res.rowCount 
        });
      }
    }
    
    return res;
  } catch (err) {
    console.error("❌ Error executing query:", err.message);
    console.error("Query:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    throw err;
  }
}

// Enhanced test function
async function testConnection() {
  try {
    const res = await query("SELECT NOW() as current_time, current_database() as db_name");
    return {
      connected: true,
      timestamp: res.rows[0].current_time,
      database: res.rows[0].db_name,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isProduction ? 'digital-ocean' : 'local'
    };
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error.message);
    return {
      connected: false,
      error: error.message,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isProduction ? 'digital-ocean' : 'local'
    };
  }
}

// Production utilities (available in all environments)
const utils = {
  // Get a client from the pool (for transactions)
  getClient: async () => {
    return await pool.connect();
  },
  
  // Graceful shutdown
  end: async () => {
    console.log('🔌 Closing PostgreSQL connection pool...');
    await pool.end();
  },
  
  // Pool status
  getPoolStatus: () => {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isProduction ? 'digital-ocean' : 'local'
    };
  }
};

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, closing database connections...');
  await utils.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, closing database connections...');
  await utils.end();
  process.exit(0);
});

// Export based on environment
module.exports = {
  query,
  testConnection,
  pool,
  isLocal,
  isProduction,
  isVercel,
  isRailway,
  ...utils
};