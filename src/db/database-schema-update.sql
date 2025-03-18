-- Update the medical_documents table to support better metadata

-- First, make sure the table exists
CREATE TABLE IF NOT EXISTS medical_documents (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add source column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'source'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN source TEXT;
  END IF;

  -- Add categories column (as an array)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'categories'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN categories TEXT[];
  END IF;
  
  -- Add original_path column
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'original_path'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN original_path TEXT;
  END IF;
  
  -- Add images column (as JSON to store paths)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'images'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
  END IF;
  
  -- Add metadata column (for additional properties)
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'medical_documents' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE medical_documents ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_medical_documents_categories ON medical_documents USING GIN (categories);
CREATE INDEX IF NOT EXISTS idx_medical_documents_source ON medical_documents (source);

-- Function to update a document with new content
CREATE OR REPLACE FUNCTION update_medical_document(
  doc_id INT,
  new_title TEXT,
  new_content TEXT,
  new_source TEXT DEFAULT NULL,
  new_categories TEXT[] DEFAULT NULL,
  new_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE medical_documents
  SET 
    title = COALESCE(new_title, title),
    content = COALESCE(new_content, content),
    source = COALESCE(new_source, source),
    categories = COALESCE(new_categories, categories),
    metadata = COALESCE(new_metadata, metadata),
    embedding = NULL -- Reset embedding to be regenerated
  WHERE id = doc_id;
END;
$$ LANGUAGE plpgsql;

-- Function to search documents by category
CREATE OR REPLACE FUNCTION search_documents_by_category(category_name TEXT)
RETURNS SETOF medical_documents AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM medical_documents
  WHERE categories @> ARRAY[category_name];
END;
$$ LANGUAGE plpgsql;