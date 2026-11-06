import "server-only";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Sale, Stand, Storefront, User } from "./types";

/** Thrown by saveStorefront when another stand already has the slug. */
export class SlugTakenError extends Error {}

/** Persistence boundary. Every read and write of stands and sales goes through here. */
export interface Store {
  getUser(id: string): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  getStand(id: string): Promise<Stand | null>;
  saveStand(stand: Stand): Promise<void>;
  /** A user's stands, oldest first. */
  listStands(ownerId: string): Promise<Stand[]>;
  getSale(id: string): Promise<Sale | null>;
  saveSale(sale: Sale): Promise<void>;
  /** Writes many sales in one transaction, for the demo seed. */
  saveSales(sales: Sale[]): Promise<void>;
  /**
   * Atomically read, change, and write one sale, so a cancel and a capture can't overwrite each other.
   * `change` returns the new sale, or null to leave it as is. Resolves to the stored sale.
   */
  updateSale(id: string, change: (sale: Sale) => Sale | null): Promise<Sale | null>;
  listSales(standId: string): Promise<Sale[]>;
  /** Deletes a stand's sales. Used by the demo reset. */
  clearSales(standId: string): Promise<void>;
  getStorefront(standId: string): Promise<Storefront | null>;
  getStorefrontBySlug(slug: string): Promise<Storefront | null>;
  /** Creates or replaces a stand's storefront. Throws SlugTakenError when another stand has the slug. */
  saveStorefront(storefront: Storefront): Promise<void>;
  /** Removes a stand's storefront, so its handle is free again. */
  deleteStorefront(standId: string): Promise<void>;
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
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        doc TEXT NOT NULL
      );
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
      CREATE TABLE IF NOT EXISTS storefronts (
        stand_id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        doc TEXT NOT NULL
      );
    `);
    // Stands from before accounts have no owner column. Add it, then index it.
    const columns = this.db.prepare("PRAGMA table_info(stands)").all() as { name: string }[];
    if (!columns.some((column) => column.name === "owner_id")) {
      this.db.exec("ALTER TABLE stands ADD COLUMN owner_id TEXT; ALTER TABLE stands ADD COLUMN created_at TEXT;");
    }
    this.db.exec("CREATE INDEX IF NOT EXISTS stands_by_owner ON stands (owner_id, created_at)");
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
    // created_at keeps a stand's place in its owner's list; it's set once and never changes.
    this.db
      .prepare(
        `INSERT INTO stands (id, owner_id, created_at, doc) VALUES (?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET owner_id = excluded.owner_id, doc = excluded.doc`,
      )
      .run(stand.id, stand.ownerId ?? null, new Date().toISOString(), JSON.stringify(stand));
  }

  async listStands(ownerId: string) {
    const rows = this.db
      .prepare("SELECT doc FROM stands WHERE owner_id = ? ORDER BY created_at, id")
      .all(ownerId) as { doc: string }[];
    return rows.map((row) => JSON.parse(row.doc) as Stand);
  }

  async getUser(id: string) {
    const row = this.db.prepare("SELECT doc FROM users WHERE id = ?").get(id) as { doc: string } | undefined;
    return row ? (JSON.parse(row.doc) as User) : null;
  }

  async saveUser(user: User) {
    this.db
      .prepare("INSERT INTO users (id, doc) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET doc = excluded.doc")
      .run(user.id, JSON.stringify(user));
  }

  async getSale(id: string) {
    return this.readSale(id);
  }

  async saveSale(sale: Sale) {
    this.writeSale(sale);
  }

  async saveSales(sales: Sale[]) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const sale of sales) this.writeSale(sale);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
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

  async getStorefront(standId: string) {
    const row = this.db.prepare("SELECT doc FROM storefronts WHERE stand_id = ?").get(standId) as { doc: string } | undefined;
    return row ? (JSON.parse(row.doc) as Storefront) : null;
  }

  async getStorefrontBySlug(slug: string) {
    const row = this.db.prepare("SELECT doc FROM storefronts WHERE slug = ?").get(slug) as { doc: string } | undefined;
    return row ? (JSON.parse(row.doc) as Storefront) : null;
  }

  async saveStorefront(storefront: Storefront) {
    // The UNIQUE slug column settles a race between two stands claiming one handle: the second write fails.
    try {
      this.db
        .prepare(
          `INSERT INTO storefronts (stand_id, slug, doc) VALUES (?, ?, ?)
           ON CONFLICT (stand_id) DO UPDATE SET slug = excluded.slug, doc = excluded.doc`,
        )
        .run(storefront.standId, storefront.slug, JSON.stringify(storefront));
    } catch (error) {
      if (error instanceof Error && /UNIQUE constraint failed: storefronts\.slug/.test(error.message)) {
        throw new SlugTakenError(storefront.slug);
      }
      throw error;
    }
  }

  async deleteStorefront(standId: string) {
    this.db.prepare("DELETE FROM storefronts WHERE stand_id = ?").run(standId);
  }
}

export function databasePath() {
  // A runtime data path, not a source file, so Turbopack shouldn't trace it into the build output.
  return resolve(/*turbopackIgnore: true*/ process.env.DATABASE_PATH || ".data/lemonpal.sqlite");
}

// Opened on first use, not at import, so `next build` doesn't create a database file.
// One connection per process, kept across dev hot reloads.
// Bump SCHEMA when the tables or Store methods change, so a running dev server opens a fresh connection
// instead of keeping one from before the change.
const SCHEMA = 4;
const globalForStore = globalThis as unknown as { lemonpalSqliteStore?: { schema: number; store: Store } };

function instance(): Store {
  const cached = globalForStore.lemonpalSqliteStore;
  if (cached?.schema === SCHEMA) return cached.store;
  const store = new SqliteStore(databasePath());
  globalForStore.lemonpalSqliteStore = { schema: SCHEMA, store };
  return store;
}

export const store: Store = {
  getUser: (id) => instance().getUser(id),
  saveUser: (user) => instance().saveUser(user),
  getStand: (id) => instance().getStand(id),
  saveStand: (stand) => instance().saveStand(stand),
  listStands: (ownerId) => instance().listStands(ownerId),
  getSale: (id) => instance().getSale(id),
  saveSale: (sale) => instance().saveSale(sale),
  saveSales: (sales) => instance().saveSales(sales),
  updateSale: (id, change) => instance().updateSale(id, change),
  listSales: (standId) => instance().listSales(standId),
  clearSales: (standId) => instance().clearSales(standId),
  getStorefront: (standId) => instance().getStorefront(standId),
  getStorefrontBySlug: (slug) => instance().getStorefrontBySlug(slug),
  saveStorefront: (storefront) => instance().saveStorefront(storefront),
  deleteStorefront: (standId) => instance().deleteStorefront(standId),
};
