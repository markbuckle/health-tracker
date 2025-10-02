-- schema-update-enhanced.sql
-- Run this to update your PostgreSQL database for enhanced RAG features

-- ============================================
-- STEP 1: ENSURE ALL REQUIRED COLUMNS EXIST
-- ============================================

-- Add all required columns if they don't exist
DO $$ 
BEGIN
  -- Add created_at if missing
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
    RAISE NOTICE 'Added created_at column';
  END IF;

  -- Add original_path if missing
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'original_path'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN original_path TEXT;
    RAISE NOTICE 'Added original_path column';
  END IF;

  -- Add chunk_index for document chunking
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'chunk_index'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN chunk_index INTEGER DEFAULT 0;
    RAISE NOTICE 'Added chunk_index column';
  END IF;

  -- Add parent_document to link chunks
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'parent_document'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN parent_document TEXT;
    RAISE NOTICE 'Added parent_document column';
  END IF;

  -- Add section_header to store section names
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'section_header'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN section_header TEXT;
    RAISE NOTICE 'Added section_header column';
  END IF;

  -- Add content_length for analytics
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'content_length'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN content_length INTEGER;
    RAISE NOTICE 'Added content_length column';
  END IF;

  -- Add is_overlapping flag for overlapping chunks
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'is_overlapping'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN is_overlapping BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Added is_overlapping column';
  END IF;

END $$;

-- ============================================
-- STEP 2: OPTIMIZE INDEXES FOR HYBRID SEARCH
-- ============================================

-- Drop old indexes if they exist
DROP INDEX IF EXISTS idx_medical_documents_embedding;
DROP INDEX IF EXISTS idx_medical_documents_embedding_hnsw;
DROP INDEX IF EXISTS idx_medical_documents_source;
DROP INDEX IF EXISTS idx_medical_documents_categories;
DROP INDEX IF EXISTS idx_medical_documents_created_at;
DROP INDEX IF EXISTS idx_medical_documents_chunk_index;
DROP INDEX IF EXISTS idx_medical_documents_parent;

-- Create optimal HNSW index for vector similarity search
-- This is CRITICAL for fast vector search performance
CREATE INDEX idx_medical_documents_embedding_hnsw 
  ON medical_documents 
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Create GIN index for full-text search (CRITICAL for hybrid search)
-- This enables fast keyword matching
CREATE INDEX idx_medical_documents_content_fts 
  ON medical_documents 
  USING GIN (to_tsvector('english', content));

-- Create GIN index for title full-text search
CREATE INDEX idx_medical_documents_title_fts 
  ON medical_documents 
  USING GIN (to_tsvector('english', title));

-- Create standard B-tree indexes for filtering
CREATE INDEX idx_medical_documents_source ON medical_documents (source);
CREATE INDEX idx_medical_documents_categories ON medical_documents USING GIN (categories);
CREATE INDEX idx_medical_documents_created_at ON medical_documents (created_at DESC);
CREATE INDEX idx_medical_documents_chunk_index ON medical_documents (chunk_index);
CREATE INDEX idx_medical_documents_parent ON medical_documents (parent_document);

-- ============================================
-- STEP 3: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to get document statistics
CREATE OR REPLACE FUNCTION get_document_stats()
RETURNS TABLE (
  total_documents BIGINT,
  documents_with_embeddings BIGINT,
  unique_sources BIGINT,
  unique_categories BIGINT,
  avg_content_length NUMERIC,
  total_chunks BIGINT,
  unique_parent_docs BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_documents,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END)::BIGINT as documents_with_embeddings,
    COUNT(DISTINCT source)::BIGINT as unique_sources,
    (SELECT COUNT(DISTINCT unnest(categories)) FROM medical_documents)::BIGINT as unique_categories,
    COALESCE(AVG(content_length), 0)::NUMERIC as avg_content_length,
    COUNT(CASE WHEN chunk_index > 0 THEN 1 END)::BIGINT as total_chunks,
    COUNT(DISTINCT parent_document)::BIGINT as unique_parent_docs
  FROM medical_documents;
END;
$$ LANGUAGE plpgsql;

-- Function to search by category
CREATE OR REPLACE FUNCTION search_by_category(category_name TEXT)
RETURNS TABLE (
  id INT,
  title TEXT,
  content TEXT,
  source TEXT,
  categories TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id,
    md.title,
    md.content,
    md.source,
    md.categories
  FROM medical_documents md
  WHERE md.categories @> ARRAY[category_name];
END;
$$ LANGUAGE plpgsql;

-- Function to get chunks for a parent document
CREATE OR REPLACE FUNCTION get_document_chunks(parent_doc_name TEXT)
RETURNS TABLE (
  id INT,
  title TEXT,
  section_header TEXT,
  chunk_index INT,
  content_length INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    md.id,
    md.title,
    md.section_header,
    md.chunk_index,
    md.content_length
  FROM medical_documents md
  WHERE md.parent_document = parent_doc_name
  ORDER BY md.chunk_index;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: VERIFY SCHEMA
-- ============================================

DO $$
DECLARE
  stats RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '===================================';
  RAISE NOTICE 'DATABASE SCHEMA UPDATE COMPLETE';
  RAISE NOTICE '===================================';
  RAISE NOTICE '';
  
  -- Get and display stats
  SELECT * INTO stats FROM get_document_stats();
  
  RAISE NOTICE 'CURRENT DATABASE STATISTICS:';
  RAISE NOTICE '  Total Documents: %', stats.total_documents;
  RAISE NOTICE '  With Embeddings: %', stats.documents_with_embeddings;
  RAISE NOTICE '  Unique Sources: %', stats.unique_sources;
  RAISE NOTICE '  Unique Categories: %', stats.unique_categories;
  RAISE NOTICE '  Avg Content Length: % chars', ROUND(stats.avg_content_length);
  RAISE NOTICE '  Total Chunks: %', stats.total_chunks;
  RAISE NOTICE '  Unique Parent Docs: %', stats.unique_parent_docs;
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '  1. Clear old data: TRUNCATE TABLE medical_documents RESTART IDENTITY CASCADE;';
  RAISE NOTICE '  2. Re-initialize: node src/db/initializeDatabase.js';
  RAISE NOTICE '  3. Test: node src/db/testPeterAttia.js';
  RAISE NOTICE '';
END $$;