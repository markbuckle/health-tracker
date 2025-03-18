const medicalKnowledgeService = require("../medicalKnowledgeService");

async function testAddDoc() {
  try {
    const docId = await medicalKnowledgeService.testAddDocument();
    console.log("Document added successfully with ID:", docId);
  } catch (error) {
    console.error("Failed to add test document:", error);
  }
}

testAddDoc();
