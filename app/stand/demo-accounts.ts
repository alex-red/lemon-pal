/**
 * The demo accounts this browser made, kept in localStorage so a person can come back to theirs after signing out
 * or from a new tab. Each holds the account's signed sign-in token, so it never leaves this browser.
 * Storage can be missing or blocked (private windows, cleared site data), so every call copes with that.
 */
export type SavedDemoAccount = { id: string; name: string; token: string; createdAt: string };

const KEY = "lemonpal.demoAccounts";

function isAccount(value: unknown): value is SavedDemoAccount {
  const v = value as Partial<SavedDemoAccount> | null;
  return typeof v?.id === "string" && typeof v.name === "string" && typeof v.token === "string" && typeof v.createdAt === "string";
}

/** Newest first. */
export function savedDemoAccounts(): SavedDemoAccount[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isAccount) : [];
  } catch {
    return [];
  }
}

function write(accounts: SavedDemoAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts));
  } catch {
    // Nothing to do: the account still works for as long as its cookie lasts.
  }
}

export function saveDemoAccount(account: SavedDemoAccount) {
  write([account, ...savedDemoAccounts().filter((a) => a.id !== account.id)]);
}

export function forgetDemoAccount(id: string) {
  write(savedDemoAccounts().filter((a) => a.id !== id));
}
