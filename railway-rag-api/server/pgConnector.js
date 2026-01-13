// src/db/pgConnector.js - Enhanced for Supabase, Google AI OCR and Vercel optimization
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
  // Local development configuration - keep your existing localhost setup
  const localConnectionString = process.env.POSTGRES_URI;
  
  poolConfig = {
    connectionString: localConnectionString,
    ssl: false,
  };
  console.log('Using local PostgreSQL configuration');
  console.log(`Connection string: ${localConnectionString}`);
} else {
  // Production configuration (Vercel/Railway/Digital Ocean with Supabase support)
  // Try multiple environment variables in order of preference
  const productionConnectionString = 
    process.env.DATABASE_URL ||     // Railway's auto-created variable OR Supabase connection
    process.env.POSTGRES_URI ||     // Your fallback
    process.env.POSTGRES_URL;       // Alternative

  console.log('Connection source:', 
    process.env.DATABASE_URL ? 'DATABASE_URL (Railway/Supabase)' :
    process.env.POSTGRES_URI ? 'POSTGRES_URI' : 
    process.env.POSTGRES_URL ? 'POSTGRES_URL' : 'NONE FOUND');
  
  if (!productionConnectionString) {
    console.error('❌ No production database connection string found!');
    console.error('Expected one of: POSTGRES_URI, POSTGRES_URL, DATABASE_URL, DB_URL');
    throw new Error('Production database connection string not configured');
  }
  
  // Auto-detect if we're using Supabase and configure SSL accordingly
  const isSupabase = productionConnectionString.includes('supabase.co');
  
  poolConfig = {
    connectionString: productionConnectionString,
    ssl: isSupabase ? { rejectUnauthorized: false } : { rejectUnauthorized: false }, // Keep SSL for all production
    max: isVercel ? 5 : 10, // Reduced max connections for Vercel
    idleTimeoutMillis: isVercel ? 10000 : 30000, // Shorter idle timeout for Vercel
    connectionTimeoutMillis: 30000, // Increased timeout for reliability
    acquireTimeoutMillis: 10000, // How long to wait for a connection from the pool
    query_timeout: 30000,
  };
  
  console.log('Using production PostgreSQL configuration');
  console.log(`Connection string: ${productionConnectionString.substring(0, 30)}...`);
  
  if (isSupabase) {
    console.log('🔗 Detected: Supabase database connection');
  }
  
  // Log which environment we detected
  if (isVercel) console.log('📍 Detected: Vercel environment (optimized connection pool)');
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
    
    // Check for pgvector extension (for RAG functionality)
    try {
      const vectorCheck = await client.query("SELECT * FROM pg_extension WHERE extname = 'vector'");
      if (vectorCheck.rows.length > 0) {
        console.log('✅ pgvector extension is available');
        
        // Check if medical_documents table exists
        const tableCheck = await client.query("SELECT to_regclass('public.medical_documents') as table_exists");
        if (tableCheck.rows[0].table_exists) {
          const docCount = await client.query('SELECT COUNT(*) FROM medical_documents');
          console.log(`📚 Medical documents available: ${docCount.rows[0].count}`);
        } else {
          console.warn('⚠️  medical_documents table not found - run setup script if needed');
        }
      } else {
        console.warn('⚠️  pgvector extension not found - RAG functionality limited');
      }
    } catch (vectorError) {
      console.warn('⚠️  Could not check pgvector extension:', vectorError.message);
    }
    
    // Initialize OCR results table if it doesn't exist (for Google AI OCR integration)
    await initializeOcrTables(client);
    
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
    } else if (err.code === 'ECONNABORTED') {
      console.error('💡 Connection timeout - check network connectivity and database availability');
    } else if (err.code === '28P01') {
      console.error('💡 Invalid username/password - check your connection string credentials');
    }
    
    return false;
  }
}

/**
 * Initialize OCR-related database tables for Google AI integration
 */
async function initializeOcrTables(client) {
  try {
    // Create OCR results table for storing Google AI OCR results
    const createOcrTableQuery = `
      CREATE TABLE IF NOT EXISTS ocr_results (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(500) NOT NULL,
        extracted_text TEXT,
        confidence_score DECIMAL(5,4) DEFAULT 0,
        processing_provider VARCHAR(50) DEFAULT 'google-ai',
        processing_time_ms INTEGER DEFAULT 0,
        character_count INTEGER DEFAULT 0,
        file_size_bytes BIGINT,
        file_type VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await client.query(createOcrTableQuery);
    
    // Create indexes for better performance
    const createIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_ocr_results_created_at ON ocr_results(created_at);
      CREATE INDEX IF NOT EXISTS idx_ocr_results_provider ON ocr_results(processing_provider);
      CREATE INDEX IF NOT EXISTS idx_ocr_results_filename ON ocr_results(filename);
    `;
    
    await client.query(createIndexesQuery);
    
    // Create lab_extractions table for parsed biomarker data
    const createLabTableQuery = `
      CREATE TABLE IF NOT EXISTS lab_extractions (
        id SERIAL PRIMARY KEY,
        ocr_result_id INTEGER REFERENCES ocr_results(id),
        biomarker_name VARCHAR(200) NOT NULL,
        biomarker_value DECIMAL(10,4),
        biomarker_unit VARCHAR(50),
        reference_range_min DECIMAL(10,4),
        reference_range_max DECIMAL(10,4),
        is_abnormal BOOLEAN DEFAULT FALSE,
        confidence_score DECIMAL(5,4) DEFAULT 0,
        test_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await client.query(createLabTableQuery);
    
    // Create indexes for lab extractions
    const createLabIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_lab_extractions_ocr_id ON lab_extractions(ocr_result_id);
      CREATE INDEX IF NOT EXISTS idx_lab_extractions_biomarker ON lab_extractions(biomarker_name);
      CREATE INDEX IF NOT EXISTS idx_lab_extractions_test_date ON lab_extractions(test_date);
      CREATE INDEX IF NOT EXISTS idx_lab_extractions_abnormal ON lab_extractions(is_abnormal);
    `;
    
    await client.query(createLabIndexesQuery);
    
    console.log('✅ OCR database tables initialized successfully');
  } catch (error) {
    console.warn('⚠️ Could not initialize OCR tables:', error.message);
    // Don't throw - this is not critical for basic functionality
  }
}

// Initialize connection on startup
initializeConnection();

// Enhanced query helper function with Vercel optimizations and vector support
async function query(text, params) {
  const start = Date.now();
  let client;
  
  try {
    // For Vercel, we need to be more careful about connection management
    if (isVercel) {
      client = await pool.connect();
    }
    
    let processedParams = params;
    
    // Special handling for vectors (for pgvector/RAG functionality)
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

    const res = isVercel 
      ? await client.query(text, processedParams)
      : await pool.query(text, processedParams);
    
    const duration = Date.now() - start;
    
    // Performance logging
    if (isProduction && duration > 1000) { 
      console.log('🐌 Slow query detected', { 
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''), 
        duration: `${duration}ms`, 
        rows: res.rowCount 
      });
    } else if (duration > 100) { // Log moderately slow queries in development
      console.log('📊 Query performance', { 
        duration: `${duration}ms`, 
        rows: res.rowCount 
      });
    }
    
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.error("❌ Error executing query:", err.message);
    console.error("Query:", text.substring(0, 100) + (text.length > 100 ? '...' : ''));
    console.error("Duration:", `${duration}ms`);
    throw err;
  } finally {
    // Release client back to pool if we acquired it manually (Vercel)
    if (client && isVercel) {
      client.release();
    }
  }
}

// Enhanced test function with OCR table validation and pgvector support
async function testConnection() {
  try {
    const res = await query("SELECT NOW() as current_time, current_database() as db_name");
    
    // Test OCR table existence
    let ocrTablesExist = false;
    try {
      await query("SELECT COUNT(*) FROM ocr_results LIMIT 1");
      ocrTablesExist = true;
    } catch (tableError) {
      console.log('ℹ️ OCR tables not found - will be created on first use');
    }
    
    // Test pgvector extension
    let pgvectorAvailable = false;
    try {
      const vectorCheck = await query("SELECT * FROM pg_extension WHERE extname = 'vector'");
      pgvectorAvailable = vectorCheck.rows.length > 0;
    } catch (vectorError) {
      console.log('ℹ️ pgvector extension not available');
    }
    
    return {
      connected: true,
      timestamp: res.rows[0].current_time,
      database: res.rows[0].db_name,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isProduction ? 'digital-ocean' : 'local',
      ocr_tables_ready: ocrTablesExist,
      pgvector_available: pgvectorAvailable,
      google_ai_ready: !!(process.env.GOOGLE_CLOUD_PROJECT_ID && 
        (process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_SERVICE_ACCOUNT_KEY))
    };
  } catch (error) {
    console.error('PostgreSQL connection test failed:', error.message);
    return {
      connected: false,
      error: error.message,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isProduction ? 'digital-ocean' : 'local',
      ocr_tables_ready: false,
      pgvector_available: false,
      google_ai_ready: false
    };
  }
}

// Production utilities (enhanced for Vercel and RAG functionality)
const utils = {
  // Get a client from the pool (for transactions)
  getClient: async () => {
    return await pool.connect();
  },
  
  // Graceful shutdown (important for Vercel functions)
  end: async () => {
    console.log('🔌 Closing PostgreSQL connection pool...');
    await pool.end();
  },
  
  // Pool status with Vercel-specific metrics
  getPoolStatus: () => {
    return {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
      environment: isLocal ? 'local' : 'production',
      platform: isVercel ? 'vercel' : isRailway ? 'railway' : isProduction ? 'digital-ocean' : 'local',
      maxConnections: poolConfig.max,
      idleTimeoutMs: poolConfig.idleTimeoutMillis,
      connectionTimeoutMs: poolConfig.connectionTimeoutMillis
    };
  },
  
  // OCR-specific utilities (keep your existing functionality)
  saveOcrResult: async (filename, text, confidence, provider = 'google-ai', processingTime = 0) => {
    const insertQuery = `
      INSERT INTO ocr_results (filename, extracted_text, confidence_score, processing_provider, processing_time_ms, character_count)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, created_at
    `;
    
    const result = await query(insertQuery, [
      filename,
      text,
      confidence,
      provider,
      processingTime,
      text.length
    ]);
    
    return result.rows[0];
  },
  
  getOcrHistory: async (limit = 50) => {
    const selectQuery = `
      SELECT id, filename, confidence_score, processing_provider, character_count, created_at
      FROM ocr_results
      ORDER BY created_at DESC
      LIMIT $1
    `;
    
    const result = await query(selectQuery, [limit]);
    return result.rows;
  },
  
  // RAG-specific utilities for pgvector
  searchSimilarDocuments: async (queryEmbedding, options = {}) => {
    const {
      threshold = 0.7,
      limit = 5,
      categories = null
    } = options;
    
    try {
      const result = await query(`
        SELECT 
          id,
          title,
          content,
          1 - (embedding <=> $1) AS similarity,
          categories,
          source,
          created_at
        FROM medical_documents 
        WHERE 
          ($3::text[] IS NULL OR categories && $3::text[]) AND
          1 - (embedding <=> $1) > $2
        ORDER BY embedding <=> $1
        LIMIT $4
      `, [queryEmbedding, threshold, categories, limit]);
      
      return result.rows;
    } catch (error) {
      console.error('Error in similarity search:', error);
      throw error;
    }
  },
  
  addMedicalDocument: async (doc) => {
    try {
      const result = await query(`
        INSERT INTO medical_documents 
        (title, content, source, categories, embedding)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, [
        doc.title,
        doc.content,
        doc.source || 'Unknown',
        doc.categories || [],
        doc.embedding
      ]);
      
      return result.rows[0].id;
    } catch (error) {
      console.error('Error adding medical document:', error);
      throw error;
    }
  }
};

// Graceful shutdown handler (essential for Vercel)
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

// Vercel-specific: Handle function timeout
// Don't run Vercel timeout code if we're on Railway
if (isVercel && !isRailway) {
  const VERCEL_TIMEOUT = 25000;
  setTimeout(async () => {
    console.log('⏰ Approaching Vercel timeout, closing connections...');
    await utils.end();
  }, VERCEL_TIMEOUT);
}

// Export based on environment (keeping your existing interface)
module.exports = {
  query,
  testConnection,
  pool,
  isLocal,
  isProduction,
  isVercel,
  isRailway,
  initializeOcrTables,
  ...utils
};