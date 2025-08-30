-- Run this SQL in your Supabase SQL Editor to create the matching function
create or replace function match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id bigint,
  title text,
  content text,
  source text,
  categories text[],
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    medical_documents.id,
    medical_documents.title,
    medical_documents.content,
    medical_documents.source,
    medical_documents.categories,
    1 - (medical_documents.embedding <=> query_embedding) as similarity
  from medical_documents
  where medical_documents.embedding is not null
    and 1 - (medical_documents.embedding <=> query_embedding) > match_threshold
  order by medical_documents.embedding <=> query_embedding
  limit match_count;
end;
$$;