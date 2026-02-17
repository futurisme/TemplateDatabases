-- Improve search latency with expression and trigram indexes.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS template_searchdocument_tsv_idx
  ON "Template"
  USING GIN (to_tsvector('simple', "searchDocument"));

CREATE INDEX IF NOT EXISTS template_title_trgm_idx
  ON "Template"
  USING GIN (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS template_summary_trgm_idx
  ON "Template"
  USING GIN (summary gin_trgm_ops);
