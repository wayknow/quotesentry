import { AppError } from '../server/errors.js';
import { hashBytes, makeId, nowIso } from '../server/utils.js';
import type { D1Database, R2Bucket } from './cloudflare.js';

const D1_ARTIFACT_MAX_BYTES = 1_000_000;

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
  backend: 'd1' | 'r2';
}

export async function saveArtifact(
  db: D1Database,
  bucket: R2Bucket | undefined,
  input: ArtifactInput,
): Promise<StoredArtifact> {
  const folder = input.kind === 'source' ? 'source' : 'exports';
  const id = makeId('art');
  const r2Key = `rfqs/${safeSegment(input.documentId)}/${folder}/${safeFilename(input.filename)}`;
  const backend = bucket ? 'r2' : 'd1';
  const key = bucket ? r2Key : `d1://quote_artifacts/${id}`;
  const sha256 = hashBytes(input.bytes);
  const createdAt = nowIso();

  if (bucket) {
    await bucket.put(r2Key, input.bytes, {
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
  } else if (input.bytes.byteLength > D1_ARTIFACT_MAX_BYTES) {
    throw new AppError(
      413,
      'D1_FILE_TOO_LARGE',
      '当前使用 D1 文件存储，单个文件不能超过 1 MB；请拆分文件或后续开通 R2。',
    );
  }

  await db.prepare(`
    INSERT INTO quote_artifacts (
      id, document_id, quote_id, kind, format, r2_key,
      content_type, size_bytes, sha256, created_at,
      storage_backend, content
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    input.documentId,
    input.quoteId || null,
    input.kind,
    input.format,
    key,
    input.contentType,
    input.bytes.byteLength,
    sha256,
    createdAt,
    backend,
    bucket ? null : toArrayBuffer(input.bytes),
  ).run();

  return { key, sha256, size: input.bytes.byteLength, backend };
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 100) || 'unknown';
}

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 160) || 'file';
}
