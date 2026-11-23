import { hashBytes, makeId, nowIso } from '../server/utils.js';
import type { D1Database, R2Bucket } from './cloudflare.js';

export interface ArtifactInput {
  documentId: string;
  quoteId?: string | null;
  kind: 'source' | 'export';
  format: string;
  filename: string;
  contentType: string;
  bytes: Uint8Array;
}

export interface StoredArtifact {
  key: string;
  sha256: string;
  size: number;
}

export async function saveArtifact(
  db: D1Database,
  bucket: R2Bucket,
  input: ArtifactInput,
): Promise<StoredArtifact> {
  const folder = input.kind === 'source' ? 'source' : 'exports';
  const key = `rfqs/${safeSegment(input.documentId)}/${folder}/${safeFilename(input.filename)}`;
  const sha256 = hashBytes(input.bytes);
  const createdAt = nowIso();

  await bucket.put(key, input.bytes, {
    httpMetadata: {
      contentType: input.contentType,
      contentDisposition: `attachment; filename="${input.filename}"`,
      cacheControl: 'private, no-store',
    },
    customMetadata: {
      documentId: input.documentId,
      quoteId: input.quoteId || '',
      kind: input.kind,
      sha256,
    },
  });

  await db.prepare(`
    INSERT INTO quote_artifacts (
      id, document_id, quote_id, kind, format, r2_key,
      content_type, size_bytes, sha256, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    makeId('art'),
    input.documentId,
    input.quoteId || null,
    input.kind,
    input.format,
    key,
    input.contentType,
    input.bytes.byteLength,
    sha256,
    createdAt,
  ).run();

  return { key, sha256, size: input.bytes.byteLength };
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100) || 'unknown';
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 160) || 'file';
}

