-- Install pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table for medical literature
CREATE TABLE medical_literature (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  authors TEXT[],
  publication_date DATE,
  doi TEXT,
  -- Categories can include: 'cardiovascular', 'metabolic', 'immunity', etc.
  categories TEXT[],
  -- Relevant biomarkers from this document
  relevant_biomarkers TEXT[],
  -- Vector embedding of the document content
  embedding vector(1536),
  -- Metadata for filtering and display
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create an index for vector similarity search
CREATE INDEX ON medical_literature USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Create a function to search for similar documents
CREATE OR REPLACE FUNCTION search_medical_literature(
  query_embedding vector(1536),
  match_threshold FLOAT,
  match_count INT,
  filter_categories TEXT[] DEFAULT NULL,
  filter_biomarkers TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id INT,
  title TEXT,
  content TEXT,
  similarity FLOAT,
  metadata JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ml.id,
    ml.title,
    ml.content,
    1 - (ml.embedding <=> query_embedding) AS similarity,
    ml.metadata
  FROM
    medical_literature ml
  WHERE
    (filter_categories IS NULL OR ml.categories && filter_categories) AND
    (filter_biomarkers IS NULL OR ml.relevant_biomarkers && filter_biomarkers) AND
    1 - (ml.embedding <=> query_embedding) > match_threshold
  ORDER BY
    ml.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;