const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('supabase.co') ? 
    { rejectUnauthorized: false } : false
});

// Check if OpenAI API key is available
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment variables');
  process.exit(1);
}

/**
 * Extract metadata from content (same logic as your existing documentLoader.js)
 */
function extractMetadata(content, fileName) {
  const metadata = {
    title: fileName.replace(/-/g, " "),
    source: "Peter Attia MD",
    categories: [],
  };

  // Extract title from the first line
  const lines = content.split("\n");
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.startsWith("#")) {
      metadata.title = firstLine.replace(/^#+\s+/, "");
    } else if (firstLine.includes("‒") || firstLine.includes("-")) {
      const parts = firstLine.split(/‒|-/);
      if (parts.length >= 2) {
        metadata.title = parts.slice(1).join("-").trim();
        metadata.episodeNumber = parts[0].trim().replace(/^#/, "");
      }
    }
  }

  // Extract categories based on content keywords (same logic as your existing code)
  const contentLower = content.toLowerCase();
  
  if (contentLower.includes("cardiovascular") || contentLower.includes("heart") || contentLower.includes("ascvd")) {
    metadata.categories.push("cardiovascular");
  }
  if (contentLower.includes("cholesterol") || contentLower.includes("lipid") || contentLower.includes("apob")) {
    metadata.categories.push("cholesterol");
  }
  if (contentLower.includes("diabetes") || contentLower.includes("insulin")) {
    metadata.categories.push("diabetes");
  }
  if (contentLower.includes("nutrition") || contentLower.includes("diet")) {
    metadata.categories.push("nutrition");
  }
  if (contentLower.includes("exercise") || contentLower.includes("fitness")) {
    metadata.categories.push("exercise");
  }

  return metadata;
}

/**
 * Process content (same logic as your existing documentLoader.js)
 */
function processContent(content) {
  let processed = content;

  // Remove image references
  processed = processed.replace(/!\[.*?\]\(.*?\)/g, "");

  // Convert headers to plain text with emphasis
  processed = processed.replace(/#{1,6}\s+(.*?)$/gm, "$1:");

  // Handle bullet points
  processed = processed.replace(/^\s*[-*+]\s+/gm, "• ");

  // Handle numbered lists
  processed = processed.replace(/^\s*\d+\.\s+/gm, "• ");

  // Remove URLs but keep text
  processed = processed.replace(/\[(.*?)\]\(.*?\)/g, "$1");

  // Remove extra whitespace
  processed = processed.replace(/\n{3,}/g, "\n\n");

  return processed.trim();
}

/**
 * Load documents from your existing medicalKnowledge directory
 */
async function loadDocumentsFromDirectory(directory) {
  const documents = [];
  
  try {
    const files = fs.readdirSync(directory);

    for (const file of files) {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        // Recursively process subdirectories
        const subDocs = await loadDocumentsFromDirectory(filePath);
        documents.push(...subDocs);
      } else if (file.endsWith('.md')) {
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = path.basename(file, '.md');

        // Process metadata and content (using your existing logic)
        const metadata = extractMetadata(content, fileName);
        const processedContent = processContent(content);

        documents.push({
          title: metadata.title,
          content: processedContent,
          source: metadata.source || "Peter Attia MD",
          categories: metadata.categories || [],
          originalPath: filePath,
          episodeNumber: metadata.episodeNumber
        });
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${directory}:`, error);
  }

  return documents;
}

async function generateEmbedding(text) {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000) // Limit to avoid token limits
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

async function seedFromMedicalKnowledge() {
  let successCount = 0;
  let errorCount = 0;

  try {
    console.log('🌱 Loading documents from your medicalKnowledge directory...');
    
    // Use the same path as your existing code
    const medicalKnowledgeDir = path.join(__dirname, '../src/db/medicalKnowledge');
    
    // Check if directory exists
    if (!fs.existsSync(medicalKnowledgeDir)) {
      console.error(`❌ Medical knowledge directory not found: ${medicalKnowledgeDir}`);
      console.error('Please make sure the path is correct relative to your script location');
      return;
    }

    console.log(`📂 Loading from directory: ${medicalKnowledgeDir}`);
    
    // Load all documents from the directory (including subdirectories)
    const documents = await loadDocumentsFromDirectory(medicalKnowledgeDir);
    
    if (documents.length === 0) {
      console.warn('⚠️  No .md files found in the medicalKnowledge directory');
      return;
    }

    console.log(`📚 Found ${documents.length} medical documents to process`);
    
    // Check current document count in database
    const countResult = await pool.query('SELECT COUNT(*) FROM medical_documents');
    const currentCount = parseInt(countResult.rows[0].count);
    console.log(`📊 Current documents in database: ${currentCount}`);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`\n📖 Processing ${i + 1}/${documents.length}: "${doc.title}"`);
      
      try {
        // Check if document already exists
        const existing = await pool.query(
          'SELECT id FROM medical_documents WHERE title = $1',
          [doc.title]
        );

        if (existing.rows.length > 0) {
          console.log('   ⏭️  Document already exists, skipping...');
          continue;
        }

        // Generate embedding
        console.log('   🧠 Generating embedding...');
        const embedding = await generateEmbedding(doc.content);
        
        // Insert document with all metadata
        await pool.query(`
          INSERT INTO medical_documents (title, content, source, categories, embedding, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [
          doc.title,
          doc.content,
          doc.source,
          doc.categories,
          `[${embedding.join(',')}]` // Convert array to PostgreSQL vector format
        ]);

        console.log('   ✅ Successfully added to database');
        successCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (docError) {
        console.error(`   ❌ Error processing "${doc.title}":`, docError.message);
        errorCount++;
      }
    }

    // Final summary
    const finalCount = await pool.query('SELECT COUNT(*) FROM medical_documents');
    const embeddedCount = await pool.query(
      'SELECT COUNT(*) FROM medical_documents WHERE embedding IS NOT NULL'
    );

    console.log('\n🎉 Medical knowledge seeding complete!');
    console.log(`📊 Total documents in database: ${finalCount.rows[0].count}`);
    console.log(`🧠 Documents with embeddings: ${embeddedCount.rows[0].count}`);
    console.log(`✅ Successfully added: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    
    if (successCount > 0) {
      console.log('\n🚀 Your RAG system is ready with your medical knowledge!');
      console.log('Next steps:');
      console.log('1. Test your RAG endpoints');
      console.log('2. Update your Railway DATABASE_URL environment variable');
      console.log('3. Deploy to production');
    }

  } catch (error) {
    console.error('❌ Seeding process failed:', error.message);
    throw error;
  } finally {
    try {
      await pool.end();
    } catch (endError) {
      // Ignore cleanup errors
    }
  }
}

// Run the seeding process
if (require.main === module) {
  seedFromMedicalKnowledge()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fatal error:', err.message);
      process.exit(1);
    });
}

module.exports = { seedFromMedicalKnowledge };