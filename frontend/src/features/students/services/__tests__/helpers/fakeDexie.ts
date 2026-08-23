/**
 * In-memory Dexie test double.
 *
 * The project has no fake-indexeddb dependency, so tests replace the Dexie
 * `db` singleton with a plain-object store that implements the small subset
 * of the Dexie Table/Collection API the domain services use:
 * get / put / toArray / update / delete / where(...).equals/.and/.filter/.first/.last
 */

type Row = Record<string, any>;

class FakeCollection {
  constructor(
    private table: FakeTable,
    private rows: Row[],
  ) {}

  and(predicate: (row: any) => boolean): FakeCollection {
    return new FakeCollection(this.table, this.rows.filter(predicate));
  }

  filter(predicate: (row: any) => boolean): FakeCollection {
    return this.and(predicate);
  }

  async toArray(): Promise<Row[]> {
    return [...this.rows];
  }

  async first(): Promise<Row | undefined> {
    return this.rows[0];
  }

  async last(): Promise<Row | undefined> {
    return this.rows[this.rows.length - 1];
  }
}

export class FakeTable {
  private rows = new Map<string, Row>();

  constructor(public tableName: string) {}

  async get(id: string): Promise<Row | undefined> {
    return this.rows.get(id);
  }

  async put(row: Row): Promise<string> {
    this.rows.set(row.id, row);
    return row.id;
  }

  bulkPut(rows: Row[]): Promise<unknown> {
    for (const row of rows) void this.put(row);
    return Promise.resolve();
  }

  async delete(id: string): Promise<void> {
    this.rows.delete(id);
  }

  async clear(): Promise<void> {}

  async update(id: string, changes: Row): Promise<number> {
    const row = this.rows.get(id);
    if (!row) return 0;
    Object.assign(row, changes);
    return 1;
  }

  async count(): Promise<number> {
    return this.rows.size;
  }

  where(index: string): unknown {
    // Capture rows at call time; equals() narrows further.
    const all = [...this.rows.values()];
    const self = this;
    const chain: any = {
      equals(value: any) {
        let matched = all.filter((r) => r[index] === value);
        const collection = new FakeCollection(self, matched);
        // Allow .where(x).equals(y).modify(...)
        chain._matched = matched;
        (collection as any).modify = async (changes: Row) => {
          for (const row of matched) Object.assign(row, changes);
          return matched.length;
        };
        return collection;
      },
      anyOf(values: string[]) {
        const matched = all.filter((r) => values.includes(r[index]));
        return new FakeCollection(self, matched);
      },
      above(value: any) {
        return new FakeCollection(self, all.filter((r) => r[index] > value));
      },
    };
    return chain;
  }

  toArray(): Promise<Row[]> {
    return Promise.resolve([...this.rows.values()]);
  }

  /** Test helper: seed rows directly. */
  seed(rows: Row[]): void {
    for (const row of rows) this.rows.set(row.id, row);
  }

  /** Test helper: read everything (bypasses query API). */
  snapshot(): Row[] {
    return [...this.rows.values()];
  }
}

export type FakeDb = Record<string, FakeTable>;

export function createFakeDb(tableNames: string[]): { db: FakeDb; reset: () => void } {
  const tables: FakeDb = {};
  for (const name of tableNames) {
    tables[name] = new FakeTable(name);
  }
  return {
    db: tables,
    reset() {
      for (const table of Object.values(tables)) table['rows'].clear();
    },
  };
}
