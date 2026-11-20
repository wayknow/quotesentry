import fs from 'node:fs';
import path from 'node:path';
import type { RfqDocument } from '../shared/schema.js';
import { config } from './config.js';
import { createSeedDocuments } from './seed.js';

interface DatabaseShape {
  version: 1;
  documents: RfqDocument[];
}

export class Store {
  private db: DatabaseShape = { version: 1, documents: [] };

  init(): void {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
    if (fs.existsSync(config.dbPath)) {
      const parsed = JSON.parse(fs.readFileSync(config.dbPath, 'utf8')) as DatabaseShape;
      if (parsed?.version === 1 && Array.isArray(parsed.documents)) {
        this.db = parsed;
      }
    }
    if (this.db.documents.length === 0) {
      this.db.documents = createSeedDocuments();
      this.save();
    }
  }

  save(): void {
    const tmp = `${config.dbPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db, null, 2));
    fs.renameSync(tmp, config.dbPath);
  }

  listDocuments(): RfqDocument[] {
    return [...this.db.documents]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((doc) => structuredClone(doc));
  }

  getDocument(id: string): RfqDocument | undefined {
    const doc = this.db.documents.find((item) => item.id === id);
    return doc ? structuredClone(doc) : undefined;
  }

  upsertDocument(doc: RfqDocument): RfqDocument {
    const index = this.db.documents.findIndex((item) => item.id === doc.id);
    const next = structuredClone(doc);
    next.updatedAt = new Date().toISOString();
    if (index >= 0) this.db.documents[index] = next;
    else this.db.documents.push(next);
    this.save();
    return structuredClone(next);
  }

  resetDemo(): RfqDocument[] {
    this.db.documents = createSeedDocuments();
    this.save();
    return this.listDocuments();
  }
}

export const store = new Store();
