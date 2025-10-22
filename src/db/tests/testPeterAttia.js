// src/db/testPeterAttia.js
const medicalKnowledgeService = require("../medicalKnowledgeService");

async function testPeterAttiaRag() {
  console.log("Testing RAG with Peter Attia content...");

  const testQueries = [
    "What does Peter Attia say about ASCVD?",
    "How does cholesterol affect heart health?",
    "What is the role of LDL in heart disease?",
  ];

  for (const query of testQueries) {
    console.log(`\n--- Query: "${query}" ---`);
    try {
      const result = await medicalKnowledgeService.performRag(query);
      console.log("Response:", result.response);
      console.log("Sources:");
      if (result.sources && result.sources.length > 0) {
        result.sources.forEach((source, i) => {
          console.log(
            `[${i + 1}] ${source.title} (Similarity: ${
              source.similarity?.toFixed(4) || "N/A"
            })`
          );
        });
      } else {
        console.log("No sources found");
      }
    } catch (error) {
      console.error("Error testing query:", error);
    }
  }
}

testPeterAttiaRag()
  .then(() => console.log("\nTest complete"))
  .catch((error) => console.error("Test failed:", error));
