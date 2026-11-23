-- D1-only artifact storage fallback.
-- R2 remains optional; when no FILES binding exists, file bytes stay in D1.

ALTER TABLE quote_artifacts
  ADD COLUMN storage_backend TEXT NOT NULL DEFAULT 'r2';

ALTER TABLE quote_artifacts
  ADD COLUMN content BLOB;
