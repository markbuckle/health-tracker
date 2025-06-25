const medicalKnowledgeService = require("./medicalKnowledgeService");

async function testRAG() {
  try {
    const query = "What is LDL cholesterol and why is it important?";
    console.log("Query:", query);

    const result = await medicalKnowledgeService.performRag(query);

    console.log("\nGenerated response:");
    console.log(result.response);

    console.log("\nSources:");
    result.sources.forEach((source, i) => {
      console.log(
        `${i + 1}. ${source.title} (similarity: ${source.similarity.toFixed(
          4
        )})`
      );
    });
  } catch (error) {
    console.error("RAG test failed:", error);
  }
}

testRAG();
