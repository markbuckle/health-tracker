-- database-schema-fix.sql
-- SIMPLIFIED VERSION - Run this to clear and optimize the database

-- ============================================
-- STEP 1: CLEAR EXISTING DOCUMENTS
-- ============================================

TRUNCATE TABLE medical_documents RESTART IDENTITY CASCADE;

-- ============================================
-- STEP 2: ENSURE ALL REQUIRED COLUMNS EXIST
-- ============================================

-- Add created_at if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
  END IF;
END $$;

-- Add original_path if missing
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'original_path'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN original_path TEXT;
  END IF;
END $$;

-- Add chunk_index for document chunking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'chunk_index'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN chunk_index INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add parent_document to link chunks
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'parent_document'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN parent_document TEXT;
  END IF;
END $$;

-- Add section_header to store section names
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'section_header'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN section_header TEXT;
  END IF;
END $$;

-- Add content_length for analytics
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'content_length'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN content_length INTEGER;
  END IF;
END $$;

-- ============================================
-- STEP 3: OPTIMIZE INDEXES
-- ============================================

-- Drop old embedding index if exists
DROP INDEX IF EXISTS idx_medical_documents_embedding;

-- Create optimal HNSW index for vector similarity search
DROP INDEX IF EXISTS idx_medical_documents_embedding_hnsw;
CREATE INDEX idx_medical_documents_embedding_hnsw 
  ON medical_documents 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create other indexes
DROP INDEX IF EXISTS idx_medical_documents_source;
CREATE INDEX idx_medical_documents_source ON medical_documents (source);

DROP INDEX IF EXISTS idx_medical_documents_categories;
CREATE INDEX idx_medical_documents_categories ON medical_documents USING GIN (categories);

DROP INDEX IF EXISTS idx_medical_documents_created_at;
CREATE INDEX idx_medical_documents_created_at ON medical_documents (created_at DESC);

DROP INDEX IF EXISTS idx_medical_documents_chunk_index;
CREATE INDEX idx_medical_documents_chunk_index ON medical_documents (chunk_index);

DROP INDEX IF EXISTS idx_medical_documents_parent;
CREATE INDEX idx_medical_documents_parent ON medical_documents (parent_document);

-- ============================================
-- STEP 4: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get document statistics
CREATE OR REPLACE FUNCTION get_document_stats()
RETURNS TABLE (
  total_documents BIGINT,
  documents_with_embeddings BIGINT,
  unique_sources BIGINT,
  avg_content_length NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_documents,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END)::BIGINT as documents_with_embeddings,
    COUNT(DISTINCT source)::BIGINT as unique_sources,
    COALESCE(AVG(content_length), 0)::NUMERIC as avg_content_length
  FROM medical_documents;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: VERIFY SCHEMA
-- ============================================

\echo '==================================='
\echo 'TABLE STRUCTURE:'
\echo '==================================='

SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'medical_documents'
ORDER BY ordinal_position;

\echo ''
\echo '==================================='
\echo 'INDEXES:'
\echo '==================================='

SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'medical_documents';

\echo ''
\echo '==================================='
\echo 'DOCUMENT STATISTICS:'
\echo '==================================='

SELECT * FROM get_document_stats();

\echo ''
\echo '✅ Database schema updated successfully!'
\echo ''
\echo '📋 Next steps:'
\echo '   1. Run: node src/db/initializeDatabase.js'
\echo '   2. Run: node src/db/checkSchema.js'
\echo '   3. Test your chatbot with: "What are the leading causes of mortality?"'
\echo ''