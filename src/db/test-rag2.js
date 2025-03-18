// test-rag.js
const { performRag } = require("./medicalKnowledgeService");

async function testRag() {
  const testQueries = [
    "What is cholesterol and why is it important?",
    "How does a heart attack happen?",
    "What is the best way for me to prevent ASCVD?",
  ];

  console.log("==== Testing RAG System ====\n");

  for (const query of testQueries) {
    console.log(`\nQuery: "${query}"`);
    console.log("-".repeat(50));

    try {
      const result = await performRag(query);
      console.log("Response:", result.response);
      console.log("Sources:", result.sources.map((s) => s.title).join(", "));
    } catch (error) {
      console.error("Error:", error.message);
    }

    console.log("-".repeat(50));
  }
}

testRag()
  .then(() => console.log("\nAll tests completed!"))
  .catch((err) => console.error("Test failed:", err))
  .finally(() => process.exit(0));
