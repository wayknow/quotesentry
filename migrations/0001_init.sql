-- QuoteSentry D1 schema.
-- Apply locally: npx wrangler d1 migrations apply quotesentry-db --local
-- Apply remote:  npx wrangler d1 migrations apply quotesentry-db --remote

CREATE TABLE IF NOT EXISTS rfq_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  status TEXT NOT NULL,
  engine_mode TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rfq_documents_updated_at
  ON rfq_documents(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_rfq_documents_customer
  ON rfq_documents(customer_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS quote_artifacts (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  quote_id TEXT,
  kind TEXT NOT NULL,
  format TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_artifacts_document
  ON quote_artifacts(document_id, created_at DESC);

