import { describe, expect, it } from 'vitest';
import type { D1Database, D1PreparedStatement, D1Result } from '../../worker/cloudflare.js';
import { D1DocumentStore } from '../../worker/store.js';
import { emptyDocument } from './helpers.js';

class FakeD1 implements D1Database {
  readonly rows = new Map<string, string>();

  prepare(query: string): D1PreparedStatement {
    return new FakeStatement(this, query);
  }

  async batch<T>(): Promise<Array<D1Result<T>>> {
    return [];
  }

  async exec(): Promise<unknown> {
    return {};
  }
}

class FakeStatement implements D1PreparedStatement {
  private values: unknown[] = [];

  constructor(
    private readonly db: FakeD1,
    private readonly query: string,
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    this.values = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.query.includes('COUNT(*)')) {
      return { count: this.db.rows.size } as T;
    }
    if (this.query.includes('WHERE id = ?')) {
      const payload = this.db.rows.get(String(this.values[0]));
      return payload ? ({ payload } as T) : null;
    }
    return null;
  }

  async all<T>(): Promise<D1Result<T>> {
    const results = [...this.db.rows.values()]
      .map((payload) => ({ payload } as T))
      .sort((left, right) => String((right as { payload: string }).payload)
        .localeCompare(String((left as { payload: string }).payload)));
    return { results, success: true };
  }

  async run(): Promise<D1Result> {
    if (this.query.startsWith('DELETE')) {
      this.db.rows.clear();
      return { success: true };
    }
    if (this.query.includes('INSERT')) {
      const id = String(this.values[0]);
      const payload = String(this.values[9]);
      if (this.query.includes('OR IGNORE') && this.db.rows.has(id)) {
        return { success: true };
      }
      this.db.rows.set(id, payload);
    }
    return { success: true };
  }
}

describe('D1 document store', () => {
  it('seeds once, reads, upserts and resets documents', async () => {
    const db = new FakeD1();
    const store = new D1DocumentStore(db as D1Database);
    const seed = emptyDocument('CUST-001', '200 pcs M12x75 hex bolt DIN 933 grade 8.8 carbon steel zinc plated');
    seed.id = 'seed-01';

    await store.ensureSeeded([seed]);
    await store.ensureSeeded([seed]);
    expect(db.rows.size).toBe(1);
    expect((await store.getDocument('seed-01'))?.id).toBe('seed-01');

    await store.upsertDocument({ ...seed, title: 'Updated title' });
    expect((await store.getDocument('seed-01'))?.title).toBe('Updated title');

    const reset = await store.resetDemo([seed]);
    expect(reset).toHaveLength(1);
    expect(reset[0].id).toBe('seed-01');
  });
});
