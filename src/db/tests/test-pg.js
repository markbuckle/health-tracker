// test-pg.js
const { Pool } = require("pg");
require("dotenv").config({ path: "../../.env" });

const pool = new Pool({
  connectionString: process.env.POSTGRES_URI,
  ssl: false,
});

async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    console.log("Connected to PostgreSQL");
    const res = await client.query("SELECT NOW()");
    console.log("Current time:", res.rows[0].now);
  } catch (err) {
    console.error("Error connecting to PostgreSQL:", err);
  } finally {
    if (client) client.release();
  }
}

testConnection();
