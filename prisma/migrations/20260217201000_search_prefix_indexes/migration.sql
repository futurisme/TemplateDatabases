-- Prefix indexes for ultra-fast short-query search paths.
CREATE INDEX IF NOT EXISTS template_title_lower_prefix_idx
  ON "Template" (lower(title) text_pattern_ops);

CREATE INDEX IF NOT EXISTS template_summary_lower_prefix_idx
  ON "Template" (lower(summary) text_pattern_ops);
