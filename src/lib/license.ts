// Promo codes unlock the Pro tier. Codes are compared by SHA-256 so they do not sit in the bundle as plain text.
export type Tier = "free" | "pro" | "founder";

const CODE_HASHES: Record<string, Tier> = {
  "1d86ab3b1864ea974c9215f727aea87b1276d0a7601531d04a7150dd0e9f7c2b": "pro",
  "a4786b1578fb2bfc44550891a3c4db2b1b86ac9aa3d396f54fe1ed71bc9f475b": "founder",
};

const RANK: Record<Tier, number> = { free: 0, pro: 1, founder: 2 };

export function tierAtLeast(tier: Tier, required: Tier): boolean {
  return RANK[tier] >= RANK[required];
}

export function maxBatchConcurrency(tier: Tier): 1 | 2 | 3 {
  return tier === "founder" ? 3 : tier === "pro" ? 2 : 1;
}

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Returns the tier a code unlocks, or null for an unknown code.
export async function redeemCode(input: string): Promise<Tier | null> {
  const code = normalizeCode(input);
  if (!code) return null;
  return CODE_HASHES[await sha256Hex(code)] ?? null;
}
