import type { RfqDocument } from '../shared/schema.js';
import { rfqDocumentSchema } from '../shared/schema.js';
import type { D1Database } from './cloudflare.js';

interface DocumentRow {
  payload: string;
}

interface CountRow {
  count: number | string;
}

const COLUMNS = `
  id, title, customer_id, source_type, status, engine_mode,
  input_hash, created_at, updated_at, payload
`;

export class D1DocumentStore {
  constructor(private readonly db: D1Database) {}

  async ensureSeeded(seeds: RfqDocument[]): Promise<void> {
    const row = await this.db.prepare('SELECT COUNT(*) AS count FROM rfq_documents')
      .first<CountRow>();
    if (Number(row?.count ?? 0) > 0) return;

    for (const document of seeds) {
      await this.insert(document);
    }
  }

  async listDocuments(): Promise<RfqDocument[]> {
    const result = await this.db.prepare(
      'SELECT payload FROM rfq_documents ORDER BY updated_at DESC',
    ).all<DocumentRow>();
    return (result.results ?? []).map((row) => this.parse(row.payload));
  }

  async getDocument(id: string): Promise<RfqDocument | undefined> {
    const row = await this.db.prepare(
      'SELECT payload FROM rfq_documents WHERE id = ?',
    ).bind(id).first<DocumentRow>();
    return row ? this.parse(row.payload) : undefined;
  }

  async upsertDocument(document: RfqDocument): Promise<RfqDocument> {
    const next: RfqDocument = {
      ...structuredClone(document),
      updatedAt: new Date().toISOString(),
    };
    await this.db.prepare(`
      INSERT INTO rfq_documents (${COLUMNS})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        customer_id = excluded.customer_id,
        source_type = excluded.source_type,
        status = excluded.status,
        engine_mode = excluded.engine_mode,
        input_hash = excluded.input_hash,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `).bind(
      next.id,
      next.title,
      next.customerId,
      next.sourceType,
      next.status,
      next.engineMode,
      next.inputHash,
      next.createdAt,
      next.updatedAt,
      JSON.stringify(next),
    ).run();
    return structuredClone(next);
  }

  async resetDemo(seeds: RfqDocument[]): Promise<RfqDocument[]> {
    await this.db.prepare('DELETE FROM rfq_documents').run();
    for (const document of seeds) {
      await this.insert(document);
    }
    return this.listDocuments();
  }

  private async insert(document: RfqDocument): Promise<void> {
    await this.db.prepare(`
      INSERT OR IGNORE INTO rfq_documents (${COLUMNS})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      document.id,
      document.title,
      document.customerId,
      document.sourceType,
      document.status,
      document.engineMode,
      document.inputHash,
      document.createdAt,
      document.updatedAt,
      JSON.stringify(document),
    ).run();
  }

  private parse(payload: string): RfqDocument {
    return rfqDocumentSchema.parse(JSON.parse(payload));
  }
}

