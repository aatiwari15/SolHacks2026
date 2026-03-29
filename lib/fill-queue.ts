/**
 * Shared in-memory fill queue — used by both fill-ready and submit endpoints.
 * Next.js module caching ensures both API routes share the same Map instance.
 */

export type FillPayload = {
  answers: Record<string, string>;
  fields: unknown[];
  expiresAt: number;
};

// Use global so the Map is shared across all API route bundles in the same process.
// Next.js webpack bundles each route separately — module-level state is NOT shared,
// but global IS shared across all bundles.
const g = global as typeof globalThis & { __fillQueue?: Map<string, FillPayload> };
if (!g.__fillQueue) g.__fillQueue = new Map<string, FillPayload>();
export const fillQueue = g.__fillQueue;

const TTL_MS = 10 * 60 * 1000;

export function pruneExpired() {
  const now = Date.now();
  for (const [k, v] of fillQueue) {
    if (v.expiresAt < now) fillQueue.delete(k);
  }
}

export function storeFillPayload(
  sessionToken: string,
  answers: Record<string, string>,
  fields: unknown[],
) {
  pruneExpired();
  fillQueue.set(sessionToken, { answers, fields, expiresAt: Date.now() + TTL_MS });
}

export function consumeFillPayload(sessionToken: string): FillPayload | null {
  const payload = fillQueue.get(sessionToken);
  if (!payload || payload.expiresAt < Date.now()) {
    fillQueue.delete(sessionToken);
    return null;
  }
  fillQueue.delete(sessionToken);
  return payload;
}
