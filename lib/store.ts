import "server-only";
import type { Sale, Stand } from "./types";

/**
 * Persistence boundary. The in-memory implementation is for local development only:
 * it loses data on restart and doesn't work across serverless instances.
 * Replace it with a durable store before deploying the judge build.
 */
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
}

class MemoryStore implements Store {
  private stands = new Map<string, Stand>();
  private sales = new Map<string, Sale>();

  async getStand(id: string) {
    return structuredClone(this.stands.get(id) ?? null);
  }
  async saveStand(stand: Stand) {
    this.stands.set(stand.id, structuredClone(stand));
  }
  async getSale(id: string) {
    return structuredClone(this.sales.get(id) ?? null);
  }
  async saveSale(sale: Sale) {
    this.sales.set(sale.id, structuredClone(sale));
  }
  async updateSale(id: string, change: (sale: Sale) => Sale | null) {
    // Synchronous between read and write, so it's atomic within one process.
    const current = this.sales.get(id);
    if (!current) return null;
    const next = change(structuredClone(current));
    if (next) this.sales.set(id, structuredClone(next));
    return structuredClone(next ?? current);
  }
  async listSales(standId: string) {
    return [...this.sales.values()].filter((s) => s.standId === standId).map((s) => structuredClone(s));
  }
}

// Keep one instance across dev hot reloads.
const globalForStore = globalThis as unknown as { lemonpalStore?: Store };
export const store: Store = (globalForStore.lemonpalStore ??= new MemoryStore());
