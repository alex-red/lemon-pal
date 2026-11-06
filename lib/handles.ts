// Rules for a store's vanity handle, the <handle> in /<handle>. Shared by the editor and the server.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

/**
 * Handles that are, or could become, Lemon Pal's own paths. Next routes static paths ahead of /[handle],
 * so a store with one of these names could never be reached.
 */
const RESERVED = new Set([
  // Routes and files in app/ and public/.
  "api", "kit", "pay", "stand", "demo", "icons", "icon", "apple-icon", "favicon", "manifest", "_next",
  // Paths a store page or the app might want later.
  "s", "store", "stores", "shop", "orders", "order", "checkout", "cart", "unlock", "login", "logout", "signin",
  "signup", "account", "settings", "admin", "help", "about", "privacy", "terms", "new", "www",
  // Names a buyer could mistake for the platform itself.
  "lemonpal", "lemon-pal", "paypal", "official", "support",
]);

/** Lowercases and turns spaces and punctuation into single hyphens: "Sunny Side!" becomes "sunny-side". */
export function toHandle(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, HANDLE_MAX)
    .replace(/-+$/g, "");
}

/** Why a handle can't be used, or null when it can. */
export function handleProblem(handle: string): string | null {
  if (handle.length < HANDLE_MIN) return `Use at least ${HANDLE_MIN} characters.`;
  if (handle.length > HANDLE_MAX) return `Use ${HANDLE_MAX} characters or fewer.`;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(handle)) return "Use lowercase letters, numbers and single hyphens.";
  if (RESERVED.has(handle)) return "That name is reserved. Try another.";
  return null;
}
