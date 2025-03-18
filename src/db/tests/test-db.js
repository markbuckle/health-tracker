const db = require("../pgConnector");

async function testDb() {
  try {
    const result = await db.testConnection();
    console.log("Database connection successful!");
    console.log("Current time from database:", result.current_time);
  } catch (error) {
    console.error("Database connection test failed:", error);
  }
}

testDb();
