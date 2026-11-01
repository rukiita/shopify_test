// Whether a fetched order or product may overwrite the stored copy, by Shopify's
// updatedAt. `stored` is null when it is not stored yet. Only an older fetch is
// skipped: updatedAt has one-second precision, so an equal value can still carry
// a later change made in the same second.
export function shouldOverwrite(stored: Date | null, fetched: Date): boolean {
  return stored === null || fetched.getTime() >= stored.getTime();
}
