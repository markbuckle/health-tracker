const { Pool } = require("pg");
require("dotenv").config({ path: "../../.env" });

// PostgreSQL connection pool
const pool = new Pool({
  connectionString:
    process.env.POSTGRES_URI ||
    "postgresql://postgres:postgres@localhost:5432/postgres",
  ssl: false,
});

// Test the connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("Error connecting to PostgreSQL:", err);
  } else {
    console.log("Connected to PostgreSQL database");
    release();
  }
});

// Helper function for executing queries
async function query(text, params) {
  try {
    // Special handling for vectors (embedding arrays)
    const processedParams = params?.map((param) => {
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

    const res = await pool.query(text, processedParams || params);
    return res;
  } catch (err) {
    console.error("Error executing query:", err);
    throw err;
  }
}

// Simplified functions for initial testing
async function testConnection() {
  const res = await query("SELECT NOW() as current_time");
  return res.rows[0];
}

module.exports = {
  query,
  testConnection,
};
