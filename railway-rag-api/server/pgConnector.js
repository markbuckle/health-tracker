// server/pgConnector.js - UPDATED FOR FLY.IO
const { Pool } = require("pg");
const path = require("path");

// Load environment variables from project root
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// Environment detection for all environments including Fly.io
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY || process.env.RAILWAY_ENVIRONMENT_NAME;
const isFly = process.env.FLY_APP_NAME || process.env.FLY_ALLOC_ID; // Fly.io detection
const isNodeProduction = process.env.NODE_ENV === 'production';
const isExplicitLocal = process.env.EXPLICIT_LOCAL === 'true';

// Check available connection strings
const postgresUri = process.env.POSTGRES_URI || process.env.POSTGRES_URL;
const databaseUrl = process.env.DATABASE_URL;
const hasLocalPostgres = postgresUri && postgresUri.includes('localhost');
const hasDatabaseUrl = !!databaseUrl;
const hasPostgresUri = !!postgresUri;

// Determine if we're in local development
const isLocal = !isVercel && !isRailway && !isFly && !isNodeProduction && !isExplicitLocal && !hasPostgresUri;

// Determine if we're in production (any production environment)
const isProduction = isVercel || isRailway || isFly || isNodeProduction || hasPostgresUri || !isLocal;

console.log(`🔍 Environment Detection:`);
console.log(`  - VERCEL: ${!!isVercel}`);
console.log(`  - RAILWAY: ${!!isRailway}`);
console.log(`  - FLY.IO: ${!!isFly}`);
console.log(`  - NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`  - POSTGRES_URI: ${postgresUri ? (postgresUri.substring(0, 30) + '...') : 'Not set'}`);
console.log(`  - DATABASE_URL: ${databaseUrl ? (databaseUrl.substring(0, 30) + '...') : 'Not set'}`);
console.log(`  - Final: ${isProduction ? 'Production' : 'Local Development'}`);

// Configure connection based on environment
let poolConfig;

if (isLocal) {
  // Local development configuration
  const localConnectionString = "postgresql://postgres:BroBeans_2317@localhost:5432/postgres";
  
  poolConfig = {
    connectionString: localConnectionString,
    ssl: false,
  };
  console.log('Using local PostgreSQL configuration');
} else {
  // Production configuration (Vercel/Railway/Fly.io)
  const productionConnectionString = 
    process.env.POSTGRES_URI ||     // Your current setup
    process.env.POSTGRES_URL ||     // Railway standard
    process.env.DATABASE_URL ||     // Vercel/Heroku/Fly.io standard
    process.env.DB_URL;             // Alternative
  
  if (!productionConnectionString) {
    console.error('❌ No production database connection string found!');
    console.error('Expected one of: POSTGRES_URI, POSTGRES_URL, DATABASE_URL, DB_URL');
    throw new Error('Production database connection string not configured');
  }
  
  poolConfig = {
    connectionString: productionConnectionString,
    ssl: { rejectUnauthorized: false },
    max: isFly ? 5 : 10, // Fly.io optimized pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
  
  console.log('Using production PostgreSQL configuration');
  console.log(`Connection string: ${productionConnectionString.substring(0, 30)}...`);
  
  // Log which environment we detected
  if (isVercel) console.log('📍 Detected: Vercel environment');
  if (isRailway) console.log('📍 Detected: Railway environment');  
  if (isFly) console.log('📍 Detected: Fly.io environment');
  if (!isVercel && !isRailway && !isFly && isNodeProduction) console.log('📍 Detected: Generic production environment');
}

// Create connection pool
const pool = new Pool(poolConfig);

// Query function
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`🔍 Executed query in ${duration}ms:`, text.substring(0, 50));
    return res;
  } catch (err) {
    console.error('❌ Database query error:', err.message);
    console.error('Query:', text.substring(0, 100));
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
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isFly ? 'fly.io' : isProduction ? 'unknown-production' : 'local'
    };
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error.message);
    return {
      connected: false,
      error: error.message,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isFly ? 'fly.io' : isProduction ? 'unknown-production' : 'local'
    };
  }
}

// Production utilities
const utils = {
  getClient: async () => {
    return await pool.connect();
  },
  
  end: async () => {
    console.log('🔌 Closing PostgreSQL connection pool...');
    await pool.end();
  },
  
  getPoolStatus: () => {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isFly ? 'fly.io' : isProduction ? 'unknown-production' : 'local'
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

module.exports = {
  query,
  testConnection,
  pool,
  isLocal,
  isProduction,
  isVercel,
  isRailway,
  isFly,
  ...utils
};