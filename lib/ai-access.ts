import "server-only";
import { cookies } from "next/headers";
import { isSellerToken, SELLER_COOKIE } from "./seller-auth";

/**
 * Whether this browser may call Claude: it entered the seller passcode, or it's development without one. Everyone
 * else gets simulated AI (lib/ai-preview.ts), so the Anthropic key only answers people who hold the passcode.
 */
export async function aiUnlocked(): Promise<boolean> {
  return isSellerToken((await cookies()).get(SELLER_COOKIE)?.value);
}
