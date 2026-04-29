// test-rag-debug.js
const medicalKnowledgeService = require("../medicalKnowledgeService");

// Test user context that matches your user data
const testUserContext = {
  profile: {
    age: 64,
    sex: "Male",
    bloodType: "B-",
    familyHistoryDetails: [
      {
        condition: "Type 1 diabetes",
        relatives: ["Father"],
        notes: "Since the age of 6"
      },
      {
        condition: "Type 2 Diabetes",
        relatives: ["Aunt"],
        notes: "No notes"
      },
      {
        condition: "COPD",
        relatives: ["Uncle"],
        notes: "No notes"
      }
    ],
    recentLabValues: {
      "Apo-B": {
        value: 0.45,
        unit: "g/L",
        referenceRange: "0.0-1.05",
        date: "2025-07-17T00:00:00.000Z"
      }
    }
  }
};

async function testPersonalQuestion() {
  console.log("\n=== Testing Personal Question ===");
  try {
    const result = await medicalKnowledgeService.performRagWithContext(
      "What is my blood type?", 
      testUserContext
    );
    
    console.log("✅ Personal Question Result:");
    console.log("Response:", result.response);
    console.log("Sources:", result.sources.length);
    console.log("Response type:", typeof result.response);
    
    return result;
  } catch (error) {
    console.error("❌ Personal question test failed:", error);
    throw error;
  }
}

async function testDatabaseQuestion() {
  console.log("\n=== Testing Database Question ===");
  try {
    const result = await medicalKnowledgeService.performRagWithContext(
      "What can I do to address high Apo-B levels?", 
      testUserContext
    );
    
    console.log("✅ Database Question Result:");
    console.log("Response:", result.response);
    console.log("Sources:", result.sources.length);
    console.log("Response type:", typeof result.response);
    
    return result;
  } catch (error) {
    console.error("❌ Database question test failed:", error);
    throw error;
  }
}

async function testBasicRag() {
  console.log("\n=== Testing Basic RAG (No Context) ===");
  try {
    const result = await medicalKnowledgeService.performRag(
      "What is LDL cholesterol?"
    );
    
    console.log("✅ Basic RAG Result:");
    console.log("Response:", result.response);
    console.log("Sources:", result.sources.length);
    console.log("Response type:", typeof result.response);
    
    return result;
  } catch (error) {
    console.error("❌ Basic RAG test failed:", error);
    throw error;
  }
}

async function runAllTests() {
  console.log("🔍 Starting RAG Debug Tests...");
  
  try {
    // Test 1: Personal question (should work)
    await testPersonalQuestion();
    
    // Test 2: Database question (currently failing)
    await testDatabaseQuestion();
    
    // Test 3: Basic RAG (no context)
    await testBasicRag();
    
    console.log("\n✅ All tests completed successfully!");
    
  } catch (error) {
    console.error("\n❌ Test suite failed:", error);
    console.error("Stack trace:", error.stack);
  }
}

// Run the tests
runAllTests();