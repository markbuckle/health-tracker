const medicalKnowledgeService = require("../medicalKnowledgeService");

async function testSearch() {
  try {
    // First add a test document if needed
    try {
      await medicalKnowledgeService.testAddDocument();
      console.log("Added test document");
    } catch (error) {
      console.log("Test document might already exist");
    }

    // Now search for documents
    const searchResults = await medicalKnowledgeService.searchDocuments(
      "What can you tell me about cholesterol?"
    );

    console.log("Search results:");
    searchResults.forEach((doc, i) => {
      console.log(
        `\nResult ${i + 1}: ${doc.title} (similarity: ${doc.similarity.toFixed(
          4
        )})`
      );
      console.log(`Excerpt: ${doc.content.substring(0, 100)}...`);
    });
  } catch (error) {
    console.error("Search test failed:", error);
  }
}

testSearch();
