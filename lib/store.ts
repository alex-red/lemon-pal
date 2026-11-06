import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Sale, Stand } from "./types";

/** Persistence boundary. Every read and write of stands and sales goes through here. */
export interface Store {
  getStand(id: string): Promise<Stand | null>;
  saveStand(stand: Stand): Promise<void>;
  getSale(id: string): Promise<Sale | null>;
  saveSale(sale: Sale): Promise<void>;
  /**
   * Atomically read, change, and write one sale, so a cancel and a capture can't overwrite each other.
   * `change` returns the new sale, or null to leave it as is. Resolves to the stored sale.
   */
  updateSale(id: string, change: (sale: Sale) => Sale | null): Promise<Sale | null>;
  listSales(standId: string): Promise<Sale[]>;
  /** Deletes a stand's sales. Used by the demo reset. */
  clearSales(standId: string): Promise<void>;
}

/**
 * SQLite through Node's built-in `node:sqlite`. Records are stored as JSON documents, with the columns
 * the queries filter on pulled out. Calls are synchronous, so each method runs without interleaving
 * within this process. Run one instance against a file: on Render, a single service with a persistent disk.
 */
class SqliteStore implements Store {
  private db: DatabaseSync;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 5000;
      CREATE TABLE IF NOT EXISTS stands (
        id TEXT PRIMARY KEY,
        doc TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY,
        stand_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        doc TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sales_by_stand ON sales (stand_id, created_at);
    `);
  }

  private readSale(id: string): Sale | null {
    const row = this.db.prepare("SELECT doc FROM sales WHERE id = ?").get(id) as { doc: string } | undefined;
    return row ? (JSON.parse(row.doc) as Sale) : null;
  }

  private writeSale(sale: Sale) {
    this.db
      .prepare(
        `INSERT INTO sales (id, stand_id, status, created_at, doc) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET status = excluded.status, doc = excluded.doc`,
      )
      .run(sale.id, sale.standId, sale.status, sale.createdAt, JSON.stringify(sale));
  }

  async getStand(id: string) {
    const row = this.db.prepare("SELECT doc FROM stands WHERE id = ?").get(id) as { doc: string } | undefined;
    return row ? (JSON.parse(row.doc) as Stand) : null;
  }

  async saveStand(stand: Stand) {
    this.db
      .prepare("INSERT INTO stands (id, doc) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET doc = excluded.doc")
      .run(stand.id, JSON.stringify(stand));
  }

  async getSale(id: string) {
    return this.readSale(id);
  }

  async saveSale(sale: Sale) {
    this.writeSale(sale);
  }

  async updateSale(id: string, change: (sale: Sale) => Sale | null) {
    // IMMEDIATE takes the write lock up front, so the read and the write see the same row.
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const current = this.readSale(id);
      const next = current ? change(current) : null;
      if (next) this.writeSale(next);
      this.db.exec("COMMIT");
      return next ?? current;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  async listSales(standId: string) {
    const rows = this.db
      .prepare("SELECT doc FROM sales WHERE stand_id = ? ORDER BY created_at")
      .all(standId) as { doc: string }[];
    return rows.map((row) => JSON.parse(row.doc) as Sale);
  }

  async clearSales(standId: string) {
    this.db.prepare("DELETE FROM sales WHERE stand_id = ?").run(standId);
  }
}

export function databasePath() {
  return resolve(process.env.DATABASE_PATH || ".data/lemonpal.sqlite");
}

// Opened on first use, not at import, so `next build` doesn't create a database file.
// One connection per process, kept across dev hot reloads.
const globalForStore = globalThis as unknown as { lemonpalSqliteStore?: Store };

function instance(): Store {
  return (globalForStore.lemonpalSqliteStore ??= new SqliteStore(databasePath()));
}

export const store: Store = {
  getStand: (id) => instance().getStand(id),
  saveStand: (stand) => instance().saveStand(stand),
  getSale: (id) => instance().getSale(id),
  saveSale: (sale) => instance().saveSale(sale),
  updateSale: (id, change) => instance().updateSale(id, change),
  listSales: (standId) => instance().listSales(standId),
  clearSales: (standId) => instance().clearSales(standId),
};
